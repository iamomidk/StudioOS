import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ModerationCaseDecisionDto } from './dto/case-decision.dto.js';
import { CreateModerationAppealDto } from './dto/create-appeal.dto.js';
import { CreateModerationPolicyDto } from './dto/create-policy.dto.js';
import { ListModerationCasesDto } from './dto/list-cases.dto.js';
import { ModerateContentDto } from './dto/moderate-content.dto.js';
import { ReportAbuseDto } from './dto/report-abuse.dto.js';

const ATTACHMENT_TYPES_ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];

@Injectable()
export class TrustSafetyService {
  constructor(private readonly prisma: PrismaService) {}

  async createPolicy(dto: CreateModerationPolicyDto, actor?: AccessClaims) {
    const policy = await this.prisma.moderationPolicy.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        description: dto.description ?? null,
        status: 'active'
      }
    });

    const version = await this.prisma.moderationPolicyVersion.create({
      data: {
        policyId: policy.id,
        versionNumber: 1,
        violationTypes: dto.violationTypes,
        keywordRules: dto.keywordRules,
        classifierConfig: Prisma.JsonNull
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ModerationPolicy',
      policy.id,
      'moderation.policy.created',
      {
        versionId: version.id,
        violationTypes: dto.violationTypes
      }
    );

    return { ...policy, activeVersionId: version.id };
  }

  async moderate(dto: ModerateContentDto, actor?: AccessClaims) {
    const policy = await this.prisma.moderationPolicy.findFirst({
      where: {
        organizationId: dto.organizationId,
        status: 'active'
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        }
      }
    });

    if (!policy || policy.versions.length === 0) {
      return {
        action: 'allow',
        matchedRules: []
      };
    }

    const policyVersion = policy.versions[0];
    if (!policyVersion) {
      return {
        action: 'allow',
        matchedRules: []
      };
    }
    const content = dto.content.toLowerCase();
    const matchedRules = policyVersion.keywordRules.filter((rule) =>
      content.includes(rule.toLowerCase())
    );

    if (matchedRules.length === 0) {
      return {
        action: 'allow',
        matchedRules: []
      };
    }

    const inferredViolationType =
      policyVersion.violationTypes.find((violationType) =>
        matchedRules.some((rule) => violationType.toLowerCase().includes(rule.toLowerCase()))
      ) ??
      policyVersion.violationTypes[0] ??
      'prohibited_content';

    const riskScore = Math.min(100, 20 + matchedRules.length * 20);
    const suggestedAction = riskScore >= 80 ? 'block' : riskScore >= 60 ? 'quarantine' : 'warn';

    const moderationCase = await this.prisma.moderationCase.create({
      data: {
        organizationId: dto.organizationId,
        policyId: policy.id,
        policyVersionId: policyVersion.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        source: dto.source ?? 'api',
        violationType: inferredViolationType,
        severity: riskScore >= 80 ? 'high' : riskScore >= 60 ? 'medium' : 'low',
        status: 'open',
        contentSnapshot: dto.content,
        matchedRules,
        riskScore,
        suggestedAction
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ModerationCase',
      moderationCase.id,
      'moderation.case.created',
      {
        matchedRules,
        riskScore,
        suggestedAction
      }
    );

    return {
      action: suggestedAction,
      caseId: moderationCase.id,
      matchedRules,
      riskScore
    };
  }

  async listCases(query: ListModerationCasesDto) {
    return this.prisma.moderationCase.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.violationType ? { violationType: query.violationType } : {})
      },
      include: {
        decisions: {
          orderBy: { createdAt: 'asc' }
        },
        appeals: {
          orderBy: { createdAt: 'asc' }
        },
        sanctions: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async decideCase(caseId: string, dto: ModerationCaseDecisionDto, actor?: AccessClaims) {
    const moderationCase = await this.prisma.moderationCase.findFirst({
      where: { id: caseId, organizationId: dto.organizationId }
    });
    if (!moderationCase) {
      throw new NotFoundException('Moderation case not found');
    }

    const decision = await this.prisma.moderationDecision.create({
      data: {
        moderationCaseId: moderationCase.id,
        action: dto.action,
        reasonCode: moderationCase.violationType,
        note: dto.note ?? null,
        actorUserId: actor?.sub ?? null
      }
    });

    let sanctionId: string | null = null;
    if (dto.action === 'block' || dto.action === 'throttle' || dto.action === 'quarantine') {
      const expiresAt = new Date();
      expiresAt.setUTCDate(expiresAt.getUTCDate() + (dto.sanctionDays ?? 14));
      const sanction = await this.prisma.moderationSanction.create({
        data: {
          organizationId: dto.organizationId,
          moderationCaseId: moderationCase.id,
          entityType: moderationCase.entityType,
          entityId: moderationCase.entityId,
          action: dto.action,
          status: 'active',
          startsAt: new Date(),
          expiresAt
        }
      });
      sanctionId = sanction.id;
    }

    const nextStatus =
      dto.action === 'allow' ? 'closed' : dto.action === 'escalate' ? 'in_review' : 'resolved';
    const updatedCase = await this.prisma.moderationCase.update({
      where: { id: moderationCase.id },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? new Date() : null
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ModerationCase',
      moderationCase.id,
      'moderation.case.decided',
      {
        decisionId: decision.id,
        action: dto.action,
        sanctionId
      }
    );

    return {
      ...updatedCase,
      decisionId: decision.id,
      sanctionId
    };
  }

  async createAppeal(caseId: string, dto: CreateModerationAppealDto, actor?: AccessClaims) {
    const moderationCase = await this.prisma.moderationCase.findFirst({
      where: {
        id: caseId,
        organizationId: dto.organizationId
      }
    });
    if (!moderationCase) {
      throw new NotFoundException('Moderation case not found');
    }
    if (moderationCase.status !== 'resolved' && moderationCase.status !== 'closed') {
      throw new BadRequestException('Appeal allowed only for resolved moderation case');
    }

    const appeal = await this.prisma.moderationAppeal.create({
      data: {
        moderationCaseId: moderationCase.id,
        reason: dto.reason,
        status: 'open',
        requestedByUserId: actor?.sub ?? null
      }
    });

    await this.prisma.moderationCase.update({
      where: { id: moderationCase.id },
      data: { status: 'appealed' }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ModerationCase',
      moderationCase.id,
      'moderation.case.appealed',
      {
        appealId: appeal.id
      }
    );

    return appeal;
  }

  async reportAbuse(dto: ReportAbuseDto, actor?: AccessClaims) {
    if (dto.attachmentType && !ATTACHMENT_TYPES_ALLOWED.includes(dto.attachmentType)) {
      throw new UnprocessableEntityException('Unsupported attachment type');
    }

    const abuseReport = await this.prisma.moderationAbuseReport.create({
      data: {
        organizationId: dto.organizationId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        message: dto.message,
        attachmentType: dto.attachmentType ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        quarantineStatus: dto.attachmentType ? 'queued_for_scan' : 'not_attached',
        reporterUserId: actor?.sub ?? null
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'ModerationAbuseReport',
      abuseReport.id,
      'moderation.abuse_report.created',
      {
        attachmentType: dto.attachmentType ?? null
      }
    );

    return abuseReport;
  }

  async metrics(organizationId: string) {
    const [casesByType, appeals, sanctionsActive, resolvedCases] = await Promise.all([
      this.prisma.moderationCase.groupBy({
        by: ['violationType'],
        where: { organizationId },
        _count: { _all: true }
      }),
      this.prisma.moderationAppeal.count({
        where: {
          moderationCase: {
            organizationId
          }
        }
      }),
      this.prisma.moderationSanction.count({
        where: {
          organizationId,
          status: 'active'
        }
      }),
      this.prisma.moderationCase.count({
        where: {
          organizationId,
          status: 'resolved'
        }
      })
    ]);

    const totalCases = casesByType.reduce((sum, row) => sum + row._count._all, 0);
    const autoTriaged = await this.prisma.moderationCase.count({
      where: {
        organizationId,
        suggestedAction: {
          not: 'allow'
        }
      }
    });

    return {
      totalCases,
      byViolationType: casesByType,
      appeals,
      sanctionsActive,
      autoTriageRate: totalCases === 0 ? 0 : autoTriaged / totalCases,
      resolutionRate: totalCases === 0 ? 0 : resolvedCases / totalCases
    };
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
}
