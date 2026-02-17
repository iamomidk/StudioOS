import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDisputeDto } from './dto/create-dispute.dto.js';
import type { DisputeStatus } from './dto/update-dispute-status.dto.js';

export interface DisputeRecord {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  reason: string;
  evidenceLink: string | null;
  status: DisputeStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DisputesService {
  private readonly disputes = new Map<string, DisputeRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  private assertEnabled() {
    if (!this.config.featureDisputesEnabled) {
      throw new NotFoundException('Disputes feature is disabled');
    }
  }

  list(organizationId: string) {
    this.assertEnabled();
    return [...this.disputes.values()].filter(
      (dispute) => dispute.organizationId === organizationId
    );
  }

  async create(dto: CreateDisputeDto, actor?: AccessClaims) {
    this.assertEnabled();

    const now = new Date().toISOString();
    const dispute: DisputeRecord = {
      id: randomUUID(),
      organizationId: dto.organizationId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      reason: dto.reason,
      evidenceLink: dto.evidenceLink ?? null,
      status: 'open',
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
          status: dispute.status
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
    this.assertEnabled();

    const dispute = this.disputes.get(disputeId);
    if (!dispute || dispute.organizationId !== organizationId) {
      throw new NotFoundException('Dispute not found');
    }

    dispute.status = status;
    dispute.updatedAt = new Date().toISOString();
    this.disputes.set(dispute.id, dispute);

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Dispute',
        entityId: dispute.id,
        action: 'dispute.status.updated',
        metadata: {
          status
        }
      }
    });

    return dispute;
  }
}
