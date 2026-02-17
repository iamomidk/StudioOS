import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdvanceContractDto } from './dto/advance-contract.dto.js';
import { ApproveContractStepDto } from './dto/approve-contract-step.dto.js';
import { ContractSearchDto } from './dto/contract-search.dto.js';
import { CreateAmendmentDto } from './dto/create-amendment.dto.js';
import { CreateClauseSetDto } from './dto/create-clause-set.dto.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { CreateRenewalScheduleDto } from './dto/create-renewal-schedule.dto.js';
import { SignatureWebhookDto } from './dto/signature-webhook.dto.js';

const HIGH_VALUE_THRESHOLD_CENTS = 2_500_00;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async createClauseSet(dto: CreateClauseSetDto, actor?: AccessClaims) {
    const clauseSet = await this.prisma.contractClauseSet.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        clauses: dto.clauses as unknown as Prisma.InputJsonValue,
        requiredClauseKeys: dto.requiredClauseKeys ?? []
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ContractClauseSet',
      clauseSet.id,
      'contract.clause_set.created',
      {
        requiredClauseCount: clauseSet.requiredClauseKeys.length
      }
    );

    return clauseSet;
  }

  async createContract(dto: CreateContractDto, actor?: AccessClaims) {
    const clauseSet = dto.clauseSetId
      ? await this.prisma.contractClauseSet.findFirst({
          where: { id: dto.clauseSetId, organizationId: dto.organizationId }
        })
      : null;

    if (dto.clauseSetId && !clauseSet) {
      throw new NotFoundException('Clause set not found');
    }

    const clauseKeys = dto.clauseKeys ?? [];
    const requiredClauseKeys = clauseSet?.requiredClauseKeys ?? [];
    const missingMandatoryClauses = requiredClauseKeys.filter((key) => !clauseKeys.includes(key));

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          organizationId: dto.organizationId,
          clientId: dto.clientId ?? null,
          contractType: dto.contractType,
          title: dto.title ?? `${dto.contractType.toUpperCase()} Contract`,
          status: 'draft',
          signatureStatus: 'pending',
          contractValueCents: dto.contractValueCents,
          riskTier: dto.riskTier ?? 'standard'
        }
      });

      const version = await tx.contractVersion.create({
        data: {
          contractId: contract.id,
          versionNumber: 1,
          clauseSetId: clauseSet?.id ?? null,
          clauseKeys,
          missingMandatoryClauses,
          snapshot: {
            templateName: clauseSet?.name ?? 'ad-hoc',
            clauseKeys,
            createdBy: actor?.sub ?? null
          }
        }
      });

      const approvalFlow = await tx.contractApprovalFlow.create({
        data: {
          contractId: contract.id,
          status: 'pending',
          policySnapshot: {
            highValueThresholdCents: HIGH_VALUE_THRESHOLD_CENTS,
            riskTier: dto.riskTier ?? 'standard'
          }
        }
      });

      const needsDualApproval =
        dto.contractValueCents >= HIGH_VALUE_THRESHOLD_CENTS ||
        (dto.riskTier ?? 'standard') === 'high';

      await tx.contractApprovalStep.createMany({
        data: [
          {
            approvalFlowId: approvalFlow.id,
            stepOrder: 1,
            approverRole: 'manager',
            status: 'pending' as const
          },
          ...(needsDualApproval
            ? [
                {
                  approvalFlowId: approvalFlow.id,
                  stepOrder: 2,
                  approverRole: 'owner',
                  status: 'pending' as const
                }
              ]
            : [])
        ]
      });

      await tx.contract.update({
        where: { id: contract.id },
        data: {
          currentVersionId: version.id,
          approvalFlowId: approvalFlow.id
        }
      });

      await this.auditTx(
        tx,
        dto.organizationId,
        actor?.sub,
        'Contract',
        contract.id,
        'contract.created',
        {
          versionNumber: 1,
          missingMandatoryClauses,
          dualApprovalRequired: needsDualApproval
        }
      );

      return {
        ...contract,
        currentVersionId: version.id,
        approvalFlowId: approvalFlow.id,
        missingMandatoryClauses
      };
    });
  }

  async advanceContract(contractId: string, dto: AdvanceContractDto, actor?: AccessClaims) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: dto.organizationId },
      include: {
        currentVersion: true,
        approvalFlow: {
          include: {
            steps: true
          }
        }
      }
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const nextStatus = this.resolveStatusTransition(dto.action);

    if (dto.action === 'send_for_signature') {
      if ((contract.currentVersion?.missingMandatoryClauses.length ?? 0) > 0) {
        throw new UnprocessableEntityException({
          message: 'Mandatory clauses missing',
          missingMandatoryClauses: contract.currentVersion?.missingMandatoryClauses ?? []
        });
      }

      const approvals = contract.approvalFlow?.steps ?? [];
      const pending = approvals.filter((step) => step.status !== 'approved');
      if (pending.length > 0) {
        throw new BadRequestException('Contract requires all approval steps before sending');
      }
    }

    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: nextStatus,
        sentAt: dto.action === 'send_for_signature' ? new Date() : contract.sentAt,
        signedAt: dto.action === 'mark_signed' ? new Date() : contract.signedAt,
        activeAt: dto.action === 'activate' ? new Date() : contract.activeAt,
        signatureStatus:
          dto.action === 'mark_signed'
            ? 'signed'
            : dto.action === 'send_for_signature'
              ? 'pending'
              : contract.signatureStatus
      }
    });

    await this.audit(dto.organizationId, actor?.sub, 'Contract', contract.id, 'contract.advanced', {
      action: dto.action,
      fromStatus: contract.status,
      toStatus: updated.status,
      reason: dto.reason ?? null
    });

    return updated;
  }

  async approveStep(contractId: string, dto: ApproveContractStepDto, actor?: AccessClaims) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: dto.organizationId },
      include: {
        approvalFlow: {
          include: { steps: true }
        }
      }
    });
    if (!contract || !contract.approvalFlow) {
      throw new NotFoundException('Contract approval flow not found');
    }

    const step = contract.approvalFlow.steps.find(
      (candidate) => candidate.id === dto.approvalStepId
    );
    if (!step) {
      throw new NotFoundException('Approval step not found');
    }

    const stepStatus = dto.approved ? 'approved' : 'rejected';
    await this.prisma.contractApprovalStep.update({
      where: { id: step.id },
      data: {
        status: stepStatus,
        actedByUserId: actor?.sub ?? null,
        actedAt: new Date(),
        note: dto.note ?? null
      }
    });

    const remainingPending = await this.prisma.contractApprovalStep.count({
      where: {
        approvalFlowId: contract.approvalFlow.id,
        status: 'pending'
      }
    });

    await this.prisma.contractApprovalFlow.update({
      where: { id: contract.approvalFlow.id },
      data: {
        status: dto.approved ? (remainingPending === 0 ? 'approved' : 'pending') : 'rejected'
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'Contract',
      contract.id,
      'contract.approval.step_decided',
      {
        stepOrder: step.stepOrder,
        approverRole: step.approverRole,
        status: stepStatus
      }
    );

    return {
      contractId: contract.id,
      approvalStepId: step.id,
      status: stepStatus,
      remainingPending
    };
  }

  async createAmendment(contractId: string, dto: CreateAmendmentDto, actor?: AccessClaims) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: dto.organizationId },
      include: { currentVersion: true }
    });

    if (!contract || !contract.currentVersion) {
      throw new NotFoundException('Contract not found');
    }

    const currentVersion = contract.currentVersion;
    if (!currentVersion) {
      throw new NotFoundException('Current contract version not found');
    }

    const nextVersionNumber = currentVersion.versionNumber + 1;
    const clauseKeys = dto.clauseKeys ?? currentVersion.clauseKeys;
    const requiredClauseKeys = await this.fetchRequiredClauseKeys(currentVersion.clauseSetId);
    const missingMandatoryClauses = requiredClauseKeys.filter((key) => !clauseKeys.includes(key));

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.contractVersion.create({
        data: {
          contractId: contract.id,
          versionNumber: nextVersionNumber,
          clauseSetId: currentVersion.clauseSetId ?? null,
          clauseKeys,
          missingMandatoryClauses,
          snapshot: {
            amendedBy: actor?.sub ?? null,
            amendmentReason: dto.reason,
            clauseKeys
          }
        }
      });

      const amendment = await tx.contractAmendment.create({
        data: {
          contractId: contract.id,
          fromVersionId: currentVersion.id,
          toVersionId: version.id,
          reason: dto.reason,
          status: 'draft'
        }
      });

      await tx.contract.update({
        where: { id: contract.id },
        data: {
          currentVersionId: version.id,
          status: 'draft',
          signatureStatus: 'pending'
        }
      });

      await this.auditTx(
        tx,
        dto.organizationId,
        actor?.sub,
        'Contract',
        contract.id,
        'contract.amended',
        {
          amendmentId: amendment.id,
          fromVersionNumber: currentVersion.versionNumber,
          toVersionNumber: version.versionNumber
        }
      );

      return {
        amendment,
        version
      };
    });
  }

  async setRenewalSchedule(
    contractId: string,
    dto: CreateRenewalScheduleDto,
    actor?: AccessClaims
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: dto.organizationId }
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const schedule = await this.prisma.contractRenewalSchedule.upsert({
      where: { contractId: contract.id },
      create: {
        contractId: contract.id,
        renewAt: new Date(dto.renewAt),
        reminderDaysBefore: dto.reminderDaysBefore ?? 30,
        autoDraftAmendment: dto.autoDraftAmendment ?? true
      },
      update: {
        renewAt: new Date(dto.renewAt),
        reminderDaysBefore: dto.reminderDaysBefore ?? 30,
        autoDraftAmendment: dto.autoDraftAmendment ?? true
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'Contract',
      contract.id,
      'contract.renewal_schedule.updated',
      {
        renewAt: schedule.renewAt,
        reminderDaysBefore: schedule.reminderDaysBefore
      }
    );

    return schedule;
  }

  async handleSignatureWebhook(contractId: string, dto: SignatureWebhookDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: dto.organizationId }
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        signatureStatus: dto.status,
        status: dto.status === 'signed' ? 'signed' : contract.status,
        signatureProviderRef: dto.providerRef ?? contract.signatureProviderRef,
        signedAt: dto.status === 'signed' ? new Date() : contract.signedAt,
        signatureLastEventId: dto.providerEventId,
        signatureLastEventAt: new Date()
      }
    });

    await this.audit(
      dto.organizationId,
      null,
      'Contract',
      contract.id,
      'contract.signature.webhook',
      {
        providerEventId: dto.providerEventId,
        status: dto.status
      }
    );

    return updated;
  }

  async searchContracts(query: ContractSearchDto) {
    return this.prisma.contract.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.contractType ? { contractType: query.contractType } : {}),
        ...(query.minValueCents ? { contractValueCents: { gte: query.minValueCents } } : {})
      },
      include: {
        currentVersion: true,
        renewalSchedule: true
      },
      orderBy: {
        createdAt: query.sort ?? 'desc'
      }
    });
  }

  private resolveStatusTransition(action: AdvanceContractDto['action']) {
    switch (action) {
      case 'submit_legal_review':
        return 'legal_review';
      case 'submit_business_approval':
        return 'business_approval';
      case 'send_for_signature':
        return 'sent';
      case 'mark_signed':
        return 'signed';
      case 'activate':
        return 'active';
      default:
        return 'draft';
    }
  }

  private async fetchRequiredClauseKeys(clauseSetId: string | null): Promise<string[]> {
    if (!clauseSetId) {
      return [];
    }

    const clauseSet = await this.prisma.contractClauseSet.findUnique({
      where: { id: clauseSetId }
    });

    return clauseSet?.requiredClauseKeys ?? [];
  }

  private async audit(
    organizationId: string,
    actorUserId: string | undefined | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        entityType,
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async auditTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string | undefined | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Record<string, unknown>
  ) {
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        entityType,
        entityId,
        action,
        metadata: metadata as Prisma.InputJsonValue
      }
    });
  }
}
