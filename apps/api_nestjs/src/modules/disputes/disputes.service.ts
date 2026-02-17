import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type DisputeEvidenceDto,
  type DisputeRiskTier,
  type DisputeType,
  CreateDisputeDto
} from './dto/create-dispute.dto.js';
import {
  type DisputeSeverity,
  type DisputeSlaClass,
  OverrideDisputePolicyDto
} from './dto/override-dispute-policy.dto.js';
import type { DisputeStatus } from './dto/update-dispute-status.dto.js';

interface PolicyDecision {
  policyVersion: string;
  severity: DisputeSeverity;
  assignedTeam: string;
  slaClass: DisputeSlaClass;
  slaTargetMinutes: number;
  evidenceScore: number;
  missingEvidenceTemplateKey: string | null;
  ruleHits: string[];
}

export interface DisputeRecord {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  reason: string;
  disputeType: DisputeType;
  rentalValueCents: number;
  customerRiskTier: DisputeRiskTier;
  providerRiskTier: DisputeRiskTier;
  evidenceLink: string | null;
  evidence: DisputeEvidenceDto | null;
  evidenceScore: number;
  status: DisputeStatus;
  severity: DisputeSeverity;
  assignedTeam: string;
  slaClass: DisputeSlaClass;
  slaTargetMinutes: number;
  policyVersion: string;
  decisionTrace: string[];
  missingEvidenceTemplateKey: string | null;
  autoTriaged: boolean;
  firstActionAt: string | null;
  overrides: Array<{
    at: string;
    actorUserId: string | null;
    reason: string;
    previousSeverity: DisputeSeverity;
    previousTeam: string;
    previousSlaClass: DisputeSlaClass;
    nextSeverity: DisputeSeverity;
    nextTeam: string;
    nextSlaClass: DisputeSlaClass;
  }>;
  createdAt: string;
  updatedAt: string;
}

const SLA_TARGETS: Record<DisputeType, Record<DisputeSeverity, number>> = {
  damage: {
    low: 1440,
    medium: 720,
    high: 240,
    critical: 120
  },
  late_return: {
    low: 1440,
    medium: 960,
    high: 360,
    critical: 180
  },
  payment: {
    low: 720,
    medium: 360,
    high: 180,
    critical: 60
  },
  other: {
    low: 1440,
    medium: 960,
    high: 360,
    critical: 180
  }
};

const CONTENT_TYPE_ALLOWLIST = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);

@Injectable()
export class DisputesService {
  private readonly disputes = new Map<string, DisputeRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  private async assertEnabled(organizationId: string) {
    if (!this.config.featureDisputesEnabled) {
      throw new NotFoundException('Disputes feature is disabled');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { pilotCohortId: true }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!this.config.isPublicRolloutEnabledFor(organizationId, organization.pilotCohortId)) {
      throw new NotFoundException('Disputes feature is not enabled for this organization');
    }
  }

  async list(organizationId: string) {
    await this.assertEnabled(organizationId);
    return [...this.disputes.values()].filter(
      (dispute) => dispute.organizationId === organizationId
    );
  }

  async create(dto: CreateDisputeDto, actor?: AccessClaims) {
    await this.assertEnabled(dto.organizationId);

    const now = new Date().toISOString();
    const policyDecision = this.evaluatePolicy(dto);

    const dispute: DisputeRecord = {
      id: randomUUID(),
      organizationId: dto.organizationId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      reason: dto.reason,
      disputeType: dto.disputeType ?? 'other',
      rentalValueCents: dto.rentalValueCents ?? 0,
      customerRiskTier: dto.customerRiskTier ?? 'low',
      providerRiskTier: dto.providerRiskTier ?? 'low',
      evidenceLink: dto.evidenceLink ?? null,
      evidence: dto.evidence ?? null,
      evidenceScore: policyDecision.evidenceScore,
      status: 'open',
      severity: policyDecision.severity,
      assignedTeam: policyDecision.assignedTeam,
      slaClass: policyDecision.slaClass,
      slaTargetMinutes: policyDecision.slaTargetMinutes,
      policyVersion: policyDecision.policyVersion,
      decisionTrace: policyDecision.ruleHits,
      missingEvidenceTemplateKey: policyDecision.missingEvidenceTemplateKey,
      autoTriaged: true,
      firstActionAt: null,
      overrides: [],
      createdAt: now,
      updatedAt: now
    };
    this.disputes.set(dispute.id, dispute);

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Dispute',
        entityId: dispute.id,
        action: 'dispute.created',
        metadata: {
          targetEntityType: dispute.entityType,
          targetEntityId: dispute.entityId,
          status: dispute.status,
          severity: dispute.severity,
          assignedTeam: dispute.assignedTeam,
          slaClass: dispute.slaClass,
          policyVersion: dispute.policyVersion,
          evidenceScore: dispute.evidenceScore,
          decisionTrace: dispute.decisionTrace
        }
      }
    });

    return dispute;
  }

  async updateStatus(
    disputeId: string,
    organizationId: string,
    status: DisputeStatus,
    actor?: AccessClaims
  ) {
    await this.assertEnabled(organizationId);

    const dispute = this.disputes.get(disputeId);
    if (!dispute || dispute.organizationId !== organizationId) {
      throw new NotFoundException('Dispute not found');
    }

    const now = new Date().toISOString();
    dispute.status = status;
    if (!dispute.firstActionAt) {
      dispute.firstActionAt = now;
    }
    dispute.updatedAt = now;
    this.disputes.set(dispute.id, dispute);

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Dispute',
        entityId: dispute.id,
        action: 'dispute.status.updated',
        metadata: {
          status,
          severity: dispute.severity,
          assignedTeam: dispute.assignedTeam
        }
      }
    });

    return dispute;
  }

  async overridePolicy(
    disputeId: string,
    organizationId: string,
    dto: OverrideDisputePolicyDto,
    actor?: AccessClaims
  ) {
    await this.assertEnabled(organizationId);

    const dispute = this.disputes.get(disputeId);
    if (!dispute || dispute.organizationId !== organizationId) {
      throw new NotFoundException('Dispute not found');
    }

    const previousSeverity = dispute.severity;
    const previousTeam = dispute.assignedTeam;
    const previousSlaClass = dispute.slaClass;

    dispute.severity = dto.severity ?? dispute.severity;
    dispute.assignedTeam = dto.assignedTeam ?? dispute.assignedTeam;
    dispute.slaClass = dto.slaClass ?? dispute.slaClass;
    dispute.slaTargetMinutes = SLA_TARGETS[dispute.disputeType][dispute.severity];
    dispute.autoTriaged = false;
    dispute.updatedAt = new Date().toISOString();
    if (!dispute.firstActionAt) {
      dispute.firstActionAt = dispute.updatedAt;
    }

    dispute.overrides.push({
      at: dispute.updatedAt,
      actorUserId: actor?.sub ?? null,
      reason: dto.reason,
      previousSeverity,
      previousTeam,
      previousSlaClass,
      nextSeverity: dispute.severity,
      nextTeam: dispute.assignedTeam,
      nextSlaClass: dispute.slaClass
    });

    dispute.decisionTrace = [...dispute.decisionTrace, `override_applied:${dto.reason}`];

    this.disputes.set(dispute.id, dispute);

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Dispute',
        entityId: dispute.id,
        action: 'dispute.policy.overridden',
        metadata: {
          reason: dto.reason,
          previousSeverity,
          previousTeam,
          previousSlaClass,
          nextSeverity: dispute.severity,
          nextTeam: dispute.assignedTeam,
          nextSlaClass: dispute.slaClass
        }
      }
    });

    return dispute;
  }

  async getMetrics(organizationId: string) {
    await this.assertEnabled(organizationId);

    const disputes = [...this.disputes.values()].filter(
      (item) => item.organizationId === organizationId
    );

    const total = disputes.length;
    const autoTriaged = disputes.filter((item) => item.autoTriaged).length;
    const evidenceDistribution = {
      low: disputes.filter((item) => item.evidenceScore < 60).length,
      medium: disputes.filter((item) => item.evidenceScore >= 60 && item.evidenceScore < 85).length,
      high: disputes.filter((item) => item.evidenceScore >= 85).length
    };

    const firstActionDurations = disputes
      .filter((item) => item.firstActionAt)
      .map((item) => Date.parse(item.firstActionAt!) - Date.parse(item.createdAt));

    const meanTimeToFirstActionMinutes =
      firstActionDurations.length === 0
        ? 0
        : firstActionDurations.reduce((sum, duration) => sum + duration, 0) /
          firstActionDurations.length /
          60000;

    const resolutionRateByType = {
      damage: this.resolutionRate(disputes, 'damage'),
      late_return: this.resolutionRate(disputes, 'late_return'),
      payment: this.resolutionRate(disputes, 'payment'),
      other: this.resolutionRate(disputes, 'other')
    };

    return {
      policyVersion: this.config.disputePolicyVersion,
      totals: {
        disputes: total,
        autoTriaged,
        autoTriageRate: total === 0 ? 0 : autoTriaged / total
      },
      evidenceCompletenessDistribution: evidenceDistribution,
      meanTimeToFirstActionMinutes,
      resolutionRateByType
    };
  }

  private evaluatePolicy(dto: CreateDisputeDto): PolicyDecision {
    const disputeType: DisputeType = dto.disputeType ?? 'other';
    const rentalValueCents = dto.rentalValueCents ?? 0;
    const customerRiskTier = dto.customerRiskTier ?? 'low';
    const providerRiskTier = dto.providerRiskTier ?? 'low';
    const evidenceScore = this.computeEvidenceScore(dto.evidence);

    let severity: DisputeSeverity = 'low';
    const ruleHits: string[] = [`policy_version:${this.config.disputePolicyVersion}`];

    if (disputeType === 'payment') {
      severity = 'high';
      ruleHits.push('type_payment_high_priority');
    }

    if (disputeType === 'damage' && rentalValueCents >= 200_000) {
      severity = 'critical';
      ruleHits.push('damage_high_exposure_critical');
    }

    if (customerRiskTier === 'high' || providerRiskTier === 'high') {
      severity = severity === 'critical' ? 'critical' : 'high';
      ruleHits.push('risk_tier_escalation');
    }

    if (evidenceScore < 60 && severity !== 'critical') {
      severity = 'medium';
      ruleHits.push('insufficient_evidence_downgraded_to_review');
    }

    const assignedTeam = this.resolveTeam(disputeType, severity);
    const slaClass = this.resolveSlaClass(severity);
    const slaTargetMinutes = SLA_TARGETS[disputeType][severity];
    const missingEvidenceTemplateKey =
      evidenceScore < 70 ? `missing-evidence:${disputeType}` : null;

    if (missingEvidenceTemplateKey) {
      ruleHits.push('missing_evidence_template_requested');
    }

    ruleHits.push(`assigned_team:${assignedTeam}`);
    ruleHits.push(`sla_class:${slaClass}`);

    return {
      policyVersion: this.config.disputePolicyVersion,
      severity,
      assignedTeam,
      slaClass,
      slaTargetMinutes,
      evidenceScore,
      missingEvidenceTemplateKey,
      ruleHits
    };
  }

  private computeEvidenceScore(evidence: DisputeEvidenceDto | undefined): number {
    if (!evidence) {
      return 0;
    }

    let score = 0;

    if (evidence.checkInPhotoUrl) {
      score += 18;
    }
    if (evidence.checkOutPhotoUrl) {
      score += 18;
    }
    if (evidence.note) {
      score += 18;
    }
    if (evidence.occurredAt) {
      score += 18;
    }
    if (evidence.actorId) {
      score += 18;
    }

    const occurredAt = evidence.occurredAt ? Date.parse(evidence.occurredAt) : Number.NaN;
    if (
      !Number.isNaN(occurredAt) &&
      Math.abs(Date.now() - occurredAt) < 365 * 24 * 60 * 60 * 1000
    ) {
      score += 5;
    }

    if (evidence.contentType && CONTENT_TYPE_ALLOWLIST.has(evidence.contentType)) {
      score += 5;
    }

    if (typeof evidence.geotagLat === 'number' && typeof evidence.geotagLng === 'number') {
      score += 5;
    }

    return Math.min(100, score);
  }

  private resolveTeam(disputeType: DisputeType, severity: DisputeSeverity): string {
    if (severity === 'critical') {
      return 'incident_response';
    }
    if (disputeType === 'payment') {
      return 'billing_ops';
    }
    if (disputeType === 'damage') {
      return 'rental_ops';
    }
    return 'support_ops';
  }

  private resolveSlaClass(severity: DisputeSeverity): DisputeSlaClass {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'urgent';
      case 'medium':
        return 'expedited';
      case 'low':
      default:
        return 'standard';
    }
  }

  private resolutionRate(disputes: DisputeRecord[], type: DisputeType): number {
    const inType = disputes.filter((item) => item.disputeType === type);
    if (inType.length === 0) {
      return 0;
    }

    return inType.filter((item) => item.status === 'resolved').length / inType.length;
  }
}
