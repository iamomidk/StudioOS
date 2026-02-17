import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { AnalyticsService } from '../analytics/analytics.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RiskService } from '../risk/risk.service.js';
import { CreateRentalEvidenceDto } from './dto/create-rental-evidence.dto.js';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto.js';
import { ListRentalEvidenceDto } from './dto/list-rental-evidence.dto.js';
import type { RentalLifecycleStatus } from './dto/update-rental-status.dto.js';

const STATUS_TRANSITIONS: Record<RentalLifecycleStatus, RentalLifecycleStatus[]> = {
  reserved: ['picked_up', 'cancelled'],
  picked_up: ['returned', 'incident'],
  incident: ['returned', 'cancelled'],
  returned: [],
  cancelled: []
};

interface RentalConflictPayload {
  code: 'RENTAL_CONFLICT';
  message: string;
  requested: {
    startsAt: string;
    endsAt: string;
  };
  conflicts: Array<{
    rentalOrderId: string;
    startsAt: string;
    endsAt: string;
    status: RentalLifecycleStatus;
  }>;
}

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly risk: RiskService
  ) {}

  async listOrders(organizationId: string, status?: RentalLifecycleStatus) {
    return this.prisma.rentalOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {})
      },
      orderBy: { startsAt: 'asc' }
    });
  }

  async createOrder(dto: CreateRentalOrderDto, actor?: AccessClaims) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Invalid rental reservation window');
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        id: dto.inventoryItemId,
        organizationId: dto.organizationId
      },
      select: { id: true }
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const risk = await this.risk.evaluate({
      organizationId: dto.organizationId,
      userId: actor?.sub ?? null,
      flowType: 'rental',
      entityType: 'RentalOrder',
      amountCents: 0
    });

    if (risk.blocked) {
      throw new ConflictException({
        code: 'RISK_BLOCKED',
        message: 'Rental reservation blocked by risk policy',
        riskLevel: risk.riskLevel,
        reasonCodes: risk.reasonCodes
      });
    }

    await this.assertNoConflicts(dto.organizationId, dto.inventoryItemId, startsAt, endsAt);

    const order = await this.prisma.rentalOrder.create({
      data: {
        organizationId: dto.organizationId,
        inventoryItemId: dto.inventoryItemId,
        clientId: dto.clientId ?? null,
        assignedUserId: dto.assignedUserId ?? null,
        startsAt,
        endsAt,
        status: 'reserved'
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'RentalOrder',
        entityId: order.id,
        action: 'rental.created',
        metadata: {
          startsAt: order.startsAt,
          endsAt: order.endsAt,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          riskMode: risk.mode,
          riskActionTaken: risk.actionTaken,
          depositMultiplier: risk.depositMultiplier
        }
      }
    });

    await this.analytics.recordEvent({
      organizationId: dto.organizationId,
      eventName: 'rental_reserved',
      actorRole: actor?.roles?.[0] ?? 'system',
      source: 'api',
      entityType: 'RentalOrder',
      entityId: order.id
    });

    return order;
  }

  async updateStatus(
    rentalOrderId: string,
    organizationId: string,
    nextStatus: RentalLifecycleStatus,
    actor?: AccessClaims
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.rentalOrder.findFirst({
        where: {
          id: rentalOrderId,
          organizationId
        }
      });
      if (!order) {
        throw new NotFoundException('Rental order not found');
      }

      if (order.status === nextStatus) {
        return order;
      }

      const allowed = STATUS_TRANSITIONS[order.status as RentalLifecycleStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Invalid rental status transition: ${order.status} -> ${nextStatus}`
        );
      }

      const updatedOrder = await tx.rentalOrder.update({
        where: { id: order.id },
        data: { status: nextStatus }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'RentalOrder',
          entityId: order.id,
          action: 'rental.status.updated',
          metadata: {
            from: order.status,
            to: nextStatus
          }
        }
      });

      if (nextStatus === 'picked_up') {
        await this.analytics.recordEvent({
          organizationId,
          eventName: 'rental_picked_up',
          actorRole: actor?.roles?.[0] ?? 'system',
          source: 'api',
          entityType: 'RentalOrder',
          entityId: order.id
        });
      }
      if (nextStatus === 'returned') {
        await this.analytics.recordEvent({
          organizationId,
          eventName: 'rental_returned',
          actorRole: actor?.roles?.[0] ?? 'system',
          source: 'api',
          entityType: 'RentalOrder',
          entityId: order.id
        });
      }
      if (nextStatus === 'incident') {
        await this.analytics.recordEvent({
          organizationId,
          eventName: 'incident_created',
          actorRole: actor?.roles?.[0] ?? 'system',
          source: 'api',
          entityType: 'RentalOrder',
          entityId: order.id
        });
      }

      return updatedOrder;
    });
  }

  async createEvidence(rentalOrderId: string, dto: CreateRentalEvidenceDto, actor?: AccessClaims) {
    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Invalid evidence timestamp');
    }

    const order = await this.prisma.rentalOrder.findFirst({
      where: {
        id: rentalOrderId,
        organizationId: dto.organizationId
      },
      select: { id: true }
    });
    if (!order) {
      throw new NotFoundException('Rental order not found');
    }

    const evidence = await this.prisma.rentalEvidence.create({
      data: {
        organizationId: dto.organizationId,
        rentalOrderId,
        actorUserId: actor?.sub ?? null,
        photoUrl: dto.photoUrl,
        note: dto.note,
        occurredAt,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'RentalEvidence',
        entityId: evidence.id,
        action: 'rental.evidence.created',
        metadata: {
          rentalOrderId,
          occurredAt: evidence.occurredAt
        }
      }
    });

    return evidence;
  }

  async listEvidence(rentalOrderId: string, query: ListRentalEvidenceDto) {
    const order = await this.prisma.rentalOrder.findFirst({
      where: {
        id: rentalOrderId,
        organizationId: query.organizationId
      },
      select: { id: true }
    });
    if (!order) {
      throw new NotFoundException('Rental order not found');
    }

    const take = query.limit ?? 20;
    const evidence = await this.prisma.rentalEvidence.findMany({
      where: {
        organizationId: query.organizationId,
        rentalOrderId
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take
    });

    return {
      items: evidence,
      nextCursor: evidence.length === take ? (evidence[evidence.length - 1]?.id ?? null) : null
    };
  }

  private async assertNoConflicts(
    organizationId: string,
    inventoryItemId: string,
    startsAt: Date,
    endsAt: Date
  ) {
    const conflicts = await this.prisma.rentalOrder.findMany({
      where: {
        organizationId,
        inventoryItemId,
        status: {
          in: ['reserved', 'picked_up', 'incident']
        },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt }
      },
      orderBy: { startsAt: 'asc' }
    });

    if (conflicts.length === 0) {
      return;
    }

    const payload: RentalConflictPayload = {
      code: 'RENTAL_CONFLICT',
      message: 'Requested rental window overlaps existing reservations',
      requested: {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      },
      conflicts: conflicts.map((order) => ({
        rentalOrderId: order.id,
        startsAt: order.startsAt.toISOString(),
        endsAt: order.endsAt.toISOString(),
        status: order.status as RentalLifecycleStatus
      }))
    };

    throw new ConflictException(payload);
  }
}
