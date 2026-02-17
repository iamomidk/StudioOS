import { BadRequestException, Injectable } from '@nestjs/common';
import { RiskLevel, RiskScoringMode } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RiskEvaluationInput {
  organizationId: string;
  userId?: string | null;
  flowType: 'rental' | 'payment';
  entityType?: string;
  entityId?: string;
  amountCents?: number;
}

export interface RiskEvaluationResult {
  id: string;
  mode: RiskScoringMode;
  riskScore: number;
  riskLevel: RiskLevel;
  reasonCodes: string[];
  actionTaken: string;
  blocked: boolean;
  bypassed: boolean;
  depositMultiplier: number;
}

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        id: true,
        pilotCohortId: true,
        createdAt: true
      }
    });

    if (!organization) {
      throw new BadRequestException('Organization not found for risk scoring');
    }

    if (this.config.riskScoringGlobalKillSwitch) {
      return this.persistAndReturn(input, organization.pilotCohortId, {
        mode: 'OFF',
        riskScore: 0,
        riskLevel: 'low',
        reasonCodes: ['global_kill_switch'],
        actionTaken: 'none',
        blocked: false,
        bypassed: true,
        depositMultiplier: 1
      });
    }

    if (this.config.riskScoringBypassOrgIds.includes(input.organizationId)) {
      return this.persistAndReturn(input, organization.pilotCohortId, {
        mode: 'ADVISORY',
        riskScore: 0,
        riskLevel: 'low',
        reasonCodes: ['org_bypass_allowlist'],
        actionTaken: 'none',
        blocked: false,
        bypassed: true,
        depositMultiplier: 1
      });
    }

    const baseMode = this.config.riskScoringMode;
    const enforceCohorts = this.config.riskScoringEnforceCohortIds;
    const effectiveMode: RiskScoringMode =
      (baseMode === 'SOFT_ENFORCE' || baseMode === 'HARD_ENFORCE') &&
      (!organization.pilotCohortId || !enforceCohorts.includes(organization.pilotCohortId))
        ? 'ADVISORY'
        : baseMode;

    if (effectiveMode === 'OFF') {
      return this.persistAndReturn(input, organization.pilotCohortId, {
        mode: 'OFF',
        riskScore: 0,
        riskLevel: 'low',
        reasonCodes: ['mode_off'],
        actionTaken: 'none',
        blocked: false,
        bypassed: false,
        depositMultiplier: 1
      });
    }

    const reasonCodes: string[] = [];
    let score = 0;

    const accountAgeDays = Math.floor(
      (Date.now() - organization.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (accountAgeDays < 30) {
      score += 20;
      reasonCodes.push('account_age_lt_30d');
    }

    const priorIncidents = await this.prisma.auditLog.count({
      where: {
        organizationId: input.organizationId,
        action: {
          in: ['incident_created', 'dispute.created']
        },
        createdAt: {
          gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        }
      }
    });
    if (priorIncidents >= 3) {
      score += 20;
      reasonCodes.push('prior_incidents_ge_3');
    }

    const activeRentals = await this.prisma.rentalOrder.count({
      where: {
        organizationId: input.organizationId,
        status: {
          in: ['reserved', 'picked_up', 'incident']
        }
      }
    });
    if (activeRentals >= 5) {
      score += 15;
      reasonCodes.push('active_rentals_ge_5');
    }

    const paymentAnomalies = await this.prisma.payment.count({
      where: {
        organizationId: input.organizationId,
        status: {
          in: ['failed', 'refunded']
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });
    if (paymentAnomalies >= 2) {
      score += 20;
      reasonCodes.push('payment_anomalies_ge_2');
    }

    const bookingVelocity = await this.prisma.booking.count({
      where: {
        organizationId: input.organizationId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    if (bookingVelocity >= 10) {
      score += 20;
      reasonCodes.push('booking_velocity_ge_10_24h');
    }

    if ((input.amountCents ?? 0) >= 200_000) {
      score += 15;
      reasonCodes.push('high_amount_exposure');
    }

    score = Math.min(100, score);

    const riskLevel: RiskLevel = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';

    let blocked = false;
    let actionTaken = 'none';
    let depositMultiplier = 1;

    if (riskLevel === 'high') {
      if (effectiveMode === 'ADVISORY') {
        actionTaken = 'advisory_only';
      } else if (effectiveMode === 'SOFT_ENFORCE') {
        if (input.flowType === 'rental') {
          actionTaken = 'manual_review_and_deposit_multiplier';
          depositMultiplier = 2;
        } else {
          actionTaken = 'additional_payment_verification';
        }
      } else if (effectiveMode === 'HARD_ENFORCE') {
        blocked = true;
        actionTaken = input.flowType === 'rental' ? 'blocked_rental' : 'blocked_payment';
      }
    }

    if (reasonCodes.length === 0) {
      reasonCodes.push('no_elevated_signals');
    }

    return this.persistAndReturn(input, organization.pilotCohortId, {
      mode: effectiveMode,
      riskScore: score,
      riskLevel,
      reasonCodes,
      actionTaken,
      blocked,
      bypassed: false,
      depositMultiplier
    });
  }

  async getExplain(organizationId: string, limit = 50) {
    return this.prisma.riskEvaluation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async getDashboard(organizationId?: string, pilotCohortId?: string) {
    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(pilotCohortId ? { pilotCohortId } : {})
    };

    const evaluations = await this.prisma.riskEvaluation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    const scoreDistribution = {
      low: evaluations.filter((item) => item.riskLevel === 'low').length,
      medium: evaluations.filter((item) => item.riskLevel === 'medium').length,
      high: evaluations.filter((item) => item.riskLevel === 'high').length
    };

    const impact = {
      blockRate:
        evaluations.length === 0
          ? 0
          : evaluations.filter((item) => item.blocked).length / evaluations.length,
      reviewRate:
        evaluations.length === 0
          ? 0
          : evaluations.filter((item) => item.actionTaken.includes('review')).length /
            evaluations.length,
      conversionImpactPlaceholder: 0
    };

    const falsePositiveQueue = evaluations.filter(
      (item) => item.blocked && item.reviewStatus === 'pending'
    );

    return {
      totals: {
        evaluations: evaluations.length,
        blocked: evaluations.filter((item) => item.blocked).length
      },
      scoreDistribution,
      impact,
      falsePositiveQueueCount: falsePositiveQueue.length
    };
  }

  async resolveFalsePositive(evaluationId: string, note: string) {
    return this.prisma.riskEvaluation.update({
      where: { id: evaluationId },
      data: {
        reviewStatus: 'resolved',
        reviewNote: note
      }
    });
  }

  private async persistAndReturn(
    input: RiskEvaluationInput,
    pilotCohortId: string | null,
    values: Omit<RiskEvaluationResult, 'id'> & { mode: RiskScoringMode }
  ): Promise<RiskEvaluationResult> {
    const created = await this.prisma.riskEvaluation.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        flowType: input.flowType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        mode: values.mode,
        riskScore: values.riskScore,
        riskLevel: values.riskLevel,
        reasonCodes: values.reasonCodes,
        actionTaken: values.actionTaken,
        blocked: values.blocked,
        bypassed: values.bypassed,
        pilotCohortId: pilotCohortId ?? null,
        reviewStatus: values.blocked ? 'pending' : 'not_required'
      }
    });

    return {
      id: created.id,
      mode: values.mode,
      riskScore: values.riskScore,
      riskLevel: values.riskLevel,
      reasonCodes: values.reasonCodes,
      actionTaken: values.actionTaken,
      blocked: values.blocked,
      bypassed: values.bypassed,
      depositMultiplier: values.depositMultiplier
    };
  }
}
