import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { QueueProducerService } from '../queues/queue.producer.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupportService } from '../support/support.service.js';
import { CreateWorkflowDto, type WorkflowActionType } from './dto/create-workflow.dto.js';
import { WorkflowDryRunDto } from './dto/workflow-dry-run.dto.js';
import { WorkflowEventDto } from './dto/workflow-event.dto.js';

interface WorkflowConditionNode {
  operator: 'AND' | 'OR';
  conditions?: Array<Record<string, unknown>>;
  groups?: WorkflowConditionNode[];
}

function asObjectRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueProducerService,
    private readonly support: SupportService
  ) {}

  getBuilderSchema() {
    return {
      triggerEvents: [
        'lead_created',
        'lead_converted',
        'booking_created',
        'booking_updated',
        'rental_state_changed',
        'invoice_overdue',
        'invoice_paid',
        'dispute_opened',
        'dispute_resolved'
      ],
      conditionOperators: ['AND', 'OR'],
      comparisonOperators: ['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte'],
      actionTypes: [
        'send_notification',
        'create_ticket',
        'apply_label',
        'enqueue_job',
        'invoke_internal_endpoint'
      ]
    };
  }

  async createWorkflow(dto: CreateWorkflowDto, actor?: AccessClaims) {
    const validation = this.validateDefinition(
      dto.trigger.eventType,
      dto.conditionGroup,
      dto.actions as Array<{ actionType: string; orderIndex: number; config: Prisma.JsonValue }>
    );
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'WORKFLOW_VALIDATION_FAILED',
        errors: validation.errors
      });
    }

    const startsAt = dto.activationStartsAt ? new Date(dto.activationStartsAt) : null;
    const endsAt = dto.activationEndsAt ? new Date(dto.activationEndsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException('activationStartsAt must be before activationEndsAt');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name,
          description: dto.description ?? null,
          dryRunEnabled: dto.dryRunEnabled ?? false,
          killSwitchEnabled: dto.killSwitchEnabled ?? false,
          maxExecutionsPerHour: dto.maxExecutionsPerHour ?? 100,
          status: 'draft'
        }
      });

      const version = await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: 1,
          status: 'draft',
          triggerConfig: dto.trigger as unknown as Prisma.InputJsonValue,
          conditionConfig: dto.conditionGroup as unknown as Prisma.InputJsonValue,
          actionConfig: dto.actions as unknown as Prisma.InputJsonValue,
          activationStartsAt: startsAt,
          activationEndsAt: endsAt
        }
      });

      await tx.workflowTrigger.create({
        data: {
          workflowId: workflow.id,
          eventType: dto.trigger.eventType,
          source: dto.trigger.source ?? 'api',
          isEnabled: true
        }
      });

      await tx.workflowConditionGroup.create({
        data: {
          workflowId: workflow.id,
          workflowVersionId: version.id,
          operator: dto.conditionGroup.operator,
          definition: dto.conditionGroup as unknown as Prisma.InputJsonValue
        }
      });

      await Promise.all(
        dto.actions.map((action) =>
          tx.workflowAction.create({
            data: {
              workflowId: workflow.id,
              workflowVersionId: version.id,
              actionType: action.actionType,
              orderIndex: action.orderIndex,
              config: action.config as unknown as Prisma.InputJsonValue
            }
          })
        )
      );

      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Workflow',
          entityId: workflow.id,
          action: 'workflow.created',
          metadata: {
            triggerEvent: dto.trigger.eventType,
            actionCount: dto.actions.length
          }
        }
      });

      return { workflow, version };
    });

    return {
      ...created.workflow,
      latestVersion: created.version
    };
  }

  async validateWorkflow(workflowId: string, organizationId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, organizationId },
      include: {
        triggers: { orderBy: { createdAt: 'asc' } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        actions: { orderBy: { orderIndex: 'asc' } }
      }
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const latestVersion = workflow.versions[0];
    const triggerEvent = workflow.triggers[0]?.eventType;
    const conditionConfig = this.parseConditionNode(latestVersion?.conditionConfig);
    const actions = workflow.actions
      .filter((item) => item.workflowVersionId === latestVersion?.id)
      .map((item) => ({
        actionType: item.actionType,
        orderIndex: item.orderIndex,
        config: item.config
      }));

    const validation = this.validateDefinition(triggerEvent ?? '', conditionConfig, actions);

    return {
      valid: validation.valid,
      errors: validation.errors,
      workflowId,
      version: latestVersion?.versionNumber ?? null
    };
  }

  async publishWorkflow(workflowId: string, organizationId: string, actor?: AccessClaims) {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.findFirst({
        where: { id: workflowId, organizationId },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 }
        }
      });
      if (!workflow) {
        throw new NotFoundException('Workflow not found');
      }
      const latestVersion = workflow.versions[0];
      if (!latestVersion) {
        throw new BadRequestException('Workflow has no versions');
      }

      await tx.workflowVersion.updateMany({
        where: { workflowId: workflow.id, status: 'published' },
        data: { status: 'archived' }
      });

      const publishedVersion = await tx.workflowVersion.update({
        where: { id: latestVersion.id },
        data: { status: 'published' }
      });

      const updatedWorkflow = await tx.workflow.update({
        where: { id: workflow.id },
        data: { status: 'published' }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Workflow',
          entityId: workflow.id,
          action: 'workflow.published',
          metadata: { version: publishedVersion.versionNumber }
        }
      });

      return {
        ...updatedWorkflow,
        publishedVersion
      };
    });
  }

  async pauseWorkflow(workflowId: string, organizationId: string, actor?: AccessClaims) {
    const existing = await this.prisma.workflow.findFirst({
      where: { id: workflowId, organizationId },
      select: { id: true }
    });
    if (!existing) {
      throw new NotFoundException('Workflow not found');
    }
    const workflow = await this.prisma.workflow.update({
      where: { id: existing.id },
      data: { status: 'paused' }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Workflow',
        entityId: workflow.id,
        action: 'workflow.paused'
      }
    });

    return workflow;
  }

  async dryRun(workflowId: string, dto: WorkflowDryRunDto) {
    const workflow = await this.getPublishedWorkflow(workflowId, dto.organizationId);
    const evaluation = this.evaluateWorkflowConditions(
      this.parseConditionNode(workflow.conditionConfig),
      dto.triggerInput
    );

    const actionCount = evaluation.matched ? workflow.actions.length : 0;

    return {
      workflowId: workflow.id,
      workflowVersionId: workflow.version.id,
      matched: evaluation.matched,
      dryRun: true,
      predictedActionCount: actionCount,
      targetEntities: actionCount > 0 ? [dto.triggerInput['entityId'] ?? 'unknown'] : [],
      rulePath: evaluation.rulePath
    };
  }

  async executeEvent(dto: WorkflowEventDto, actor?: AccessClaims) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        organizationId: dto.organizationId,
        status: 'published',
        killSwitchEnabled: false,
        triggers: {
          some: {
            eventType: dto.eventType,
            isEnabled: true
          }
        }
      },
      include: {
        versions: {
          where: { status: 'published' },
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        actions: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    const results: Array<Record<string, unknown>> = [];
    for (const workflow of workflows) {
      const version = workflow.versions[0];
      if (!version || !this.isVersionActive(version.activationStartsAt, version.activationEndsAt)) {
        continue;
      }

      const existingCount = await this.prisma.workflowExecutionLog.count({
        where: {
          workflowId: workflow.id,
          entityType: dto.entityType,
          entityId: dto.entityId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000)
          }
        }
      });
      if (existingCount >= workflow.maxExecutionsPerHour) {
        await this.persistExecutionLog({
          organizationId: dto.organizationId,
          workflow,
          version,
          dto,
          dryRun: workflow.dryRunEnabled,
          status: 'blocked',
          rulePath: [{ node: 'loop_prevention', matched: false }],
          actionResults: [{ type: 'loop_prevention', status: 'blocked' }],
          errorMessage: 'Max executions per entity/time window reached'
        });
        results.push({ workflowId: workflow.id, status: 'blocked', reason: 'loop_prevention' });
        continue;
      }

      const evaluation = this.evaluateWorkflowConditions(
        this.parseConditionNode(version.conditionConfig),
        dto.payload
      );
      const versionActions = workflow.actions.filter(
        (item) => item.workflowVersionId === version.id
      );
      if (!evaluation.matched) {
        await this.persistExecutionLog({
          organizationId: dto.organizationId,
          workflow,
          version,
          dto,
          dryRun: workflow.dryRunEnabled,
          status: 'skipped',
          rulePath: evaluation.rulePath,
          actionResults: []
        });
        results.push({ workflowId: workflow.id, status: 'skipped' });
        continue;
      }

      try {
        const actionResults = workflow.dryRunEnabled
          ? versionActions.map((action) => ({ actionType: action.actionType, status: 'dry_run' }))
          : await this.runActions(versionActions, dto, actor);

        await this.persistExecutionLog({
          organizationId: dto.organizationId,
          workflow,
          version,
          dto,
          dryRun: workflow.dryRunEnabled,
          status: 'success',
          rulePath: evaluation.rulePath,
          actionResults
        });

        results.push({
          workflowId: workflow.id,
          status: workflow.dryRunEnabled ? 'dry_run' : 'success',
          actionCount: actionResults.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown workflow action failure';
        await this.persistExecutionLog({
          organizationId: dto.organizationId,
          workflow,
          version,
          dto,
          dryRun: workflow.dryRunEnabled,
          status: 'failed',
          rulePath: evaluation.rulePath,
          actionResults: [],
          errorMessage: message
        });
        results.push({
          workflowId: workflow.id,
          status: 'failed',
          error: message
        });
      }
    }

    return {
      eventType: dto.eventType,
      entityType: dto.entityType,
      entityId: dto.entityId,
      executedWorkflows: results
    };
  }

  async listExecutionHistory(workflowId: string, organizationId: string, limit = 50) {
    return this.prisma.workflowExecutionLog.findMany({
      where: {
        workflowId,
        organizationId
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200)
    });
  }

  private async getPublishedWorkflow(workflowId: string, organizationId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId
      },
      include: {
        versions: {
          where: { status: 'published' },
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        actions: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    const version = workflow.versions[0];
    if (!version) {
      throw new BadRequestException('No published workflow version');
    }

    return {
      ...workflow,
      version,
      conditionConfig: version.conditionConfig,
      actions: workflow.actions.filter((item) => item.workflowVersionId === version.id)
    };
  }

  private validateDefinition(
    triggerEvent: string,
    conditionGroup: WorkflowConditionNode,
    actions: Array<{ actionType: string; orderIndex: number; config: Prisma.JsonValue }>
  ) {
    const errors: string[] = [];

    if (!this.getBuilderSchema().triggerEvents.includes(triggerEvent)) {
      errors.push(`Unsupported trigger event: ${triggerEvent}`);
    }

    if (!conditionGroup || !['AND', 'OR'].includes(conditionGroup.operator)) {
      errors.push('Condition group must include operator AND/OR');
    }

    const actionTypes = this.getBuilderSchema().actionTypes;
    for (const action of actions) {
      if (!actionTypes.includes(action.actionType as WorkflowActionType)) {
        errors.push(`Unsupported action type: ${action.actionType}`);
      }
      if (!Number.isInteger(action.orderIndex) || action.orderIndex < 0) {
        errors.push(`Action ${action.actionType} has invalid orderIndex`);
      }
    }

    const sortedIndexes = actions.map((item) => item.orderIndex).sort((a, b) => a - b);
    for (let index = 1; index < sortedIndexes.length; index += 1) {
      if (sortedIndexes[index] === sortedIndexes[index - 1]) {
        errors.push('Action orderIndex values must be unique for deterministic execution order');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private evaluateWorkflowConditions(
    node: WorkflowConditionNode,
    payload: Record<string, unknown>
  ): { matched: boolean; rulePath: Array<Record<string, unknown>> } {
    const localEvaluations = (node.conditions ?? []).map((condition) =>
      this.evaluateCondition(condition, payload)
    );
    const childEvaluations = (node.groups ?? []).map((group) =>
      this.evaluateWorkflowConditions(group, payload)
    );

    const allMatches = [
      ...localEvaluations.map((item) => item.matched),
      ...childEvaluations.map((item) => item.matched)
    ];
    const matched = node.operator === 'AND' ? allMatches.every(Boolean) : allMatches.some(Boolean);

    return {
      matched,
      rulePath: [
        {
          nodeOperator: node.operator,
          matched,
          conditions: localEvaluations.map((item) => item.details)
        },
        ...childEvaluations.flatMap((item) => item.rulePath)
      ]
    };
  }

  private evaluateCondition(condition: Record<string, unknown>, payload: Record<string, unknown>) {
    const field = condition['field']?.toString() ?? '';
    const op = condition['op']?.toString() ?? 'eq';
    const expected = condition['value'];
    const actual = payload[field];

    let matched = false;
    if (op === 'eq') {
      matched = actual === expected;
    } else if (op === 'neq') {
      matched = actual !== expected;
    } else if (op === 'contains') {
      matched = actual?.toString().includes(expected?.toString() ?? '') ?? false;
    } else if (op === 'in') {
      matched = Array.isArray(expected) ? expected.includes(actual) : false;
    } else if (op === 'gt') {
      matched = Number(actual) > Number(expected);
    } else if (op === 'gte') {
      matched = Number(actual) >= Number(expected);
    } else if (op === 'lt') {
      matched = Number(actual) < Number(expected);
    } else if (op === 'lte') {
      matched = Number(actual) <= Number(expected);
    }

    return {
      matched,
      details: {
        field,
        op,
        expected,
        actual,
        matched
      }
    };
  }

  private async runActions(
    actions: Array<{ actionType: string; config: Prisma.JsonValue; orderIndex: number }>,
    event: WorkflowEventDto,
    actor?: AccessClaims
  ) {
    const sortedActions = [...actions].sort((left, right) => left.orderIndex - right.orderIndex);

    const results: Array<Record<string, unknown>> = [];
    for (const action of sortedActions) {
      const config = asObjectRecord(action.config);

      if (action.actionType === 'send_notification') {
        await this.queues.enqueueNotification({
          recipientUserId:
            config['recipientUserId']?.toString() ?? actor?.sub ?? 'workflow-system-recipient',
          channel: (config['channel']?.toString() as 'email' | 'push') ?? 'email',
          template: config['template']?.toString() ?? 'workflow-event',
          variables: {
            eventType: event.eventType,
            entityId: event.entityId
          }
        });
        results.push({ actionType: action.actionType, status: 'executed' });
        continue;
      }

      if (action.actionType === 'create_ticket') {
        await this.support.createTicket(
          {
            organizationId: event.organizationId,
            title:
              config['title']?.toString() ?? `Workflow generated ticket for ${event.eventType}`,
            description:
              config['description']?.toString() ??
              `Automated workflow ticket for ${event.entityType}:${event.entityId}`,
            severity: (config['severity']?.toString() as 'p0' | 'p1' | 'p2' | 'p3') ?? 'p2',
            source: 'api'
          },
          actor
        );
        results.push({ actionType: action.actionType, status: 'executed' });
        continue;
      }

      if (action.actionType === 'apply_label') {
        await this.prisma.auditLog.create({
          data: {
            organizationId: event.organizationId,
            actorUserId: actor?.sub ?? null,
            entityType: event.entityType,
            entityId: event.entityId,
            action: 'workflow.label.applied',
            metadata: {
              label: config['label']?.toString() ?? 'workflow-labeled'
            }
          }
        });
        results.push({ actionType: action.actionType, status: 'executed' });
        continue;
      }

      if (action.actionType === 'enqueue_job') {
        const queue = config['queue']?.toString() ?? 'notifications';
        if (queue === 'media-jobs') {
          await this.queues.enqueueMediaJob({
            assetId: config['assetId']?.toString() ?? event.entityId,
            sourceUrl: config['sourceUrl']?.toString() ?? 'https://example.com/source.jpg',
            operation:
              (config['operation']?.toString() as 'metadata' | 'thumbnail' | 'proxy') ?? 'metadata'
          });
        } else {
          await this.queues.enqueueNotification({
            recipientUserId:
              config['recipientUserId']?.toString() ?? actor?.sub ?? 'workflow-system',
            channel: (config['channel']?.toString() as 'email' | 'push') ?? 'email',
            template: config['template']?.toString() ?? 'workflow-job',
            variables: {
              queue,
              entityId: event.entityId
            }
          });
        }
        results.push({ actionType: action.actionType, status: 'executed' });
        continue;
      }

      if (action.actionType === 'invoke_internal_endpoint') {
        const endpoint = config['path']?.toString() ?? '';
        const allowlist = ['/health', '/metrics'];
        if (!allowlist.includes(endpoint)) {
          throw new ForbiddenException('Internal endpoint is not allowlisted');
        }
        results.push({ actionType: action.actionType, status: 'executed', endpoint });
        continue;
      }

      results.push({ actionType: action.actionType, status: 'skipped' });
    }

    return results;
  }

  private isVersionActive(startsAt: Date | null, endsAt: Date | null): boolean {
    const now = new Date();
    if (startsAt && startsAt > now) {
      return false;
    }
    if (endsAt && endsAt < now) {
      return false;
    }
    return true;
  }

  private async persistExecutionLog(input: {
    organizationId: string;
    workflow: { id: string };
    version: { id: string };
    dto: WorkflowEventDto;
    dryRun: boolean;
    status: 'success' | 'skipped' | 'blocked' | 'failed';
    rulePath: Array<Record<string, unknown>>;
    actionResults: Array<Record<string, unknown>>;
    errorMessage?: string;
  }) {
    await this.prisma.workflowExecutionLog.create({
      data: {
        organizationId: input.organizationId,
        workflowId: input.workflow.id,
        workflowVersionId: input.version.id,
        triggerEvent: input.dto.eventType,
        entityType: input.dto.entityType,
        entityId: input.dto.entityId,
        dryRun: input.dryRun,
        status: input.status,
        triggerInput: input.dto.payload as unknown as Prisma.InputJsonValue,
        rulePath: input.rulePath as unknown as Prisma.InputJsonValue,
        actionResults: input.actionResults as unknown as Prisma.InputJsonValue,
        errorMessage: input.errorMessage ?? null
      }
    });
  }

  private parseConditionNode(value: Prisma.JsonValue | null | undefined): WorkflowConditionNode {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const operator = record['operator'] === 'OR' ? 'OR' : 'AND';
      const conditions = Array.isArray(record['conditions'])
        ? (record['conditions'] as Array<Record<string, unknown>>)
        : [];
      const groups = Array.isArray(record['groups'])
        ? (record['groups'] as Prisma.JsonValue[]).map((item) => this.parseConditionNode(item))
        : [];
      return { operator, conditions, groups };
    }

    return { operator: 'AND', conditions: [], groups: [] };
  }
}
