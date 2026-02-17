import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ComputePartnerSettlementPeriodDto } from './dto/partner-settlement/compute-period.dto.js';
import { CreatePartnerSettlementAdjustmentDto } from './dto/partner-settlement/create-adjustment.dto.js';
import { CreatePartnerSettlementAgreementDto } from './dto/partner-settlement/create-agreement.dto.js';
import { CreatePartnerSettlementPeriodDto } from './dto/partner-settlement/create-period.dto.js';
import { ListPartnerSettlementPeriodsDto } from './dto/partner-settlement/list-periods.dto.js';
import { UpdatePartnerSettlementPeriodStatusDto } from './dto/partner-settlement/update-period-status.dto.js';

@Injectable()
export class PartnerSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async createAgreement(dto: CreatePartnerSettlementAgreementDto, actor?: AccessClaims) {
    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.settlementPartner.upsert({
        where: {
          organizationId_name: {
            organizationId: dto.organizationId,
            name: dto.partnerName
          }
        },
        update: {
          externalRef: dto.partnerExternalRef ?? null,
          status: 'active'
        },
        create: {
          organizationId: dto.organizationId,
          name: dto.partnerName,
          externalRef: dto.partnerExternalRef ?? null,
          status: 'active'
        }
      });

      const agreement = await tx.settlementAgreement.create({
        data: {
          organizationId: dto.organizationId,
          partnerId: partner.id,
          status: 'active',
          startsAt: new Date(dto.startsAt),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          currency: dto.currency ?? 'USD',
          minimumGuaranteeCents: dto.minimumGuaranteeCents ?? 0,
          clawbackEnabled: false
        }
      });

      await tx.settlementRevenueShareRule.create({
        data: {
          agreementId: agreement.id,
          productCategory: dto.productCategory ?? 'all',
          shareBps: dto.shareBps,
          tierConfig: Prisma.JsonNull,
          minCents: 0,
          maxCents: null
        }
      });

      await this.auditTx(
        tx,
        dto.organizationId,
        actor?.sub,
        'SettlementAgreement',
        agreement.id,
        'settlement.agreement.created',
        {
          partnerId: partner.id,
          shareBps: dto.shareBps
        }
      );

      return agreement;
    });
  }

  async createPeriod(
    agreementId: string,
    dto: CreatePartnerSettlementPeriodDto,
    actor?: AccessClaims
  ) {
    const agreement = await this.prisma.settlementAgreement.findFirst({
      where: { id: agreementId, organizationId: dto.organizationId }
    });
    if (!agreement) {
      throw new NotFoundException('Settlement agreement not found');
    }

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd <= periodStart) {
      throw new UnprocessableEntityException('Period end must be after period start');
    }

    const period = await this.prisma.settlementPeriod.create({
      data: {
        organizationId: dto.organizationId,
        agreementId,
        periodStart,
        periodEnd,
        status: 'draft'
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'SettlementPeriod',
      period.id,
      'settlement.period.created',
      {
        agreementId,
        periodStart,
        periodEnd
      }
    );

    return period;
  }

  async computePeriod(
    periodId: string,
    dto: ComputePartnerSettlementPeriodDto,
    actor?: AccessClaims
  ) {
    const period = await this.prisma.settlementPeriod.findFirst({
      where: { id: periodId, organizationId: dto.organizationId },
      include: {
        agreement: {
          include: {
            rules: true,
            partner: true
          }
        }
      }
    });
    if (!period) {
      throw new NotFoundException('Settlement period not found');
    }

    const rule = period.agreement.rules[0];
    if (!rule) {
      throw new UnprocessableEntityException('Revenue share rule is missing');
    }

    const eligiblePayments = await this.prisma.payment.findMany({
      where: {
        organizationId: dto.organizationId,
        status: 'succeeded',
        paidAt: {
          gte: period.periodStart,
          lt: period.periodEnd
        }
      }
    });

    const existingAccruals = await this.prisma.settlementAccrualEntry.findMany({
      where: { periodId: period.id }
    });
    if (existingAccruals.length > 0) {
      await this.prisma.settlementAccrualEntry.deleteMany({
        where: { periodId: period.id }
      });
    }

    const createdAccruals = await Promise.all(
      eligiblePayments.map((payment) => {
        const grossCents = payment.amountCents;
        const feeCents = Math.round(grossCents * 0.03);
        const netCents = grossCents - feeCents;
        const baseCents = dto.basis === 'gross' ? grossCents : netCents;
        const partnerShareCents = Math.max(0, Math.round((baseCents * rule.shareBps) / 10000));

        return this.prisma.settlementAccrualEntry.create({
          data: {
            periodId: period.id,
            organizationId: dto.organizationId,
            sourceEntityType: 'Payment',
            sourceEntityId: payment.id,
            grossCents,
            netCents,
            feeCents,
            taxCents: 0,
            chargebackCents: 0,
            partnerShareCents,
            currency: payment.currency
          }
        });
      })
    );

    const carriedAdjustments = await this.prisma.settlementAdjustmentEntry.findMany({
      where: {
        organizationId: dto.organizationId,
        carryForward: true,
        appliedToPeriodId: null,
        periodId: {
          not: period.id
        }
      }
    });

    if (carriedAdjustments.length > 0) {
      await this.prisma.settlementAdjustmentEntry.updateMany({
        where: {
          id: {
            in: carriedAdjustments.map((entry) => entry.id)
          }
        },
        data: {
          appliedToPeriodId: period.id
        }
      });
    }

    const ownAdjustments = await this.prisma.settlementAdjustmentEntry.findMany({
      where: {
        periodId: period.id,
        carryForward: false
      }
    });

    const totalAccruedCents = createdAccruals.reduce(
      (sum, entry) => sum + entry.partnerShareCents,
      0
    );
    const carriedAmountCents = carriedAdjustments.reduce(
      (sum, entry) => sum + entry.amountCents,
      0
    );
    const totalAdjustmentsCents =
      ownAdjustments.reduce((sum, entry) => sum + entry.amountCents, 0) + carriedAmountCents;

    const totalPayableCents = Math.max(0, totalAccruedCents + totalAdjustmentsCents);

    await this.prisma.settlementStatement.upsert({
      where: { periodId: period.id },
      create: {
        periodId: period.id,
        organizationId: dto.organizationId,
        totalAccruedCents,
        totalAdjustmentsCents,
        totalPayableCents,
        snapshot: {
          partnerId: period.agreement.partnerId,
          ruleBps: rule.shareBps,
          basis: dto.basis ?? 'net',
          paymentCount: eligiblePayments.length,
          carriedAdjustmentCount: carriedAdjustments.length
        }
      },
      update: {
        totalAccruedCents,
        totalAdjustmentsCents,
        totalPayableCents,
        snapshot: {
          partnerId: period.agreement.partnerId,
          ruleBps: rule.shareBps,
          basis: dto.basis ?? 'net',
          paymentCount: eligiblePayments.length,
          carriedAdjustmentCount: carriedAdjustments.length
        }
      }
    });

    await this.prisma.settlementPayoutInstruction.upsert({
      where: { periodId: period.id },
      create: {
        periodId: period.id,
        organizationId: dto.organizationId,
        amountCents: totalPayableCents,
        currency: period.agreement.currency,
        status: 'pending'
      },
      update: {
        amountCents: totalPayableCents,
        currency: period.agreement.currency,
        status: 'pending'
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'SettlementPeriod',
      period.id,
      'settlement.period.computed',
      {
        totalAccruedCents,
        totalAdjustmentsCents,
        totalPayableCents,
        paymentCount: eligiblePayments.length
      }
    );

    return this.report(period.id, dto.organizationId);
  }

  async createAdjustment(
    periodId: string,
    dto: CreatePartnerSettlementAdjustmentDto,
    actor?: AccessClaims
  ) {
    const period = await this.prisma.settlementPeriod.findFirst({
      where: { id: periodId, organizationId: dto.organizationId }
    });
    if (!period) {
      throw new NotFoundException('Settlement period not found');
    }

    const adjustment = await this.prisma.settlementAdjustmentEntry.create({
      data: {
        periodId: period.id,
        organizationId: dto.organizationId,
        amountCents: dto.amountCents,
        reasonCode: dto.reasonCode,
        note: dto.note ?? null,
        carryForward: dto.carryForward ?? false
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'SettlementPeriod',
      period.id,
      'settlement.adjustment.created',
      {
        adjustmentId: adjustment.id,
        amountCents: dto.amountCents,
        carryForward: adjustment.carryForward
      }
    );

    return adjustment;
  }

  async updatePeriodStatus(
    periodId: string,
    dto: UpdatePartnerSettlementPeriodStatusDto,
    actor?: AccessClaims
  ) {
    const period = await this.prisma.settlementPeriod.findFirst({
      where: {
        id: periodId,
        organizationId: dto.organizationId
      },
      include: {
        payout: true,
        statement: true
      }
    });

    if (!period) {
      throw new NotFoundException('Settlement period not found');
    }

    let nextStatus = period.status;
    switch (dto.action) {
      case 'review':
        nextStatus = 'review';
        break;
      case 'approve':
        if (!period.statement) {
          throw new BadRequestException('Period must be computed before approval');
        }
        nextStatus = 'approved';
        break;
      case 'pay':
        if (!period.payout) {
          throw new BadRequestException('Payout instruction not found');
        }
        nextStatus = 'paid';
        break;
      case 'reconcile':
        nextStatus = 'reconciled';
        break;
      case 'hold':
        nextStatus = 'on_hold';
        break;
      case 'release':
        nextStatus = 'review';
        break;
      default:
        nextStatus = period.status;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedPeriod = await tx.settlementPeriod.update({
        where: { id: period.id },
        data: {
          status: nextStatus,
          holdReason: dto.action === 'hold' ? (dto.note ?? 'manual_hold') : null,
          reviewedAt: nextStatus === 'review' ? new Date() : period.reviewedAt,
          approvedAt: nextStatus === 'approved' ? new Date() : period.approvedAt,
          reconciledAt: nextStatus === 'reconciled' ? new Date() : period.reconciledAt
        }
      });

      if (period.payout) {
        await tx.settlementPayoutInstruction.update({
          where: { id: period.payout.id },
          data: {
            status:
              dto.action === 'pay'
                ? 'paid'
                : dto.action === 'hold'
                  ? 'on_hold'
                  : dto.action === 'release'
                    ? 'pending'
                    : period.payout.status,
            payoutReference:
              dto.action === 'pay'
                ? (dto.payoutReference ?? `payout-${period.id}`)
                : period.payout.payoutReference,
            paidAt: dto.action === 'pay' ? new Date() : period.payout.paidAt
          }
        });
      }

      if (period.statement && dto.action === 'approve') {
        await tx.settlementStatement.update({
          where: { id: period.statement.id },
          data: {
            approvedByUserId: actor?.sub ?? null,
            approvedAt: new Date()
          }
        });
      }

      await this.auditTx(
        tx,
        dto.organizationId,
        actor?.sub,
        'SettlementPeriod',
        period.id,
        'settlement.period.status_updated',
        {
          action: dto.action,
          fromStatus: period.status,
          toStatus: nextStatus
        }
      );

      return updatedPeriod;
    });
  }

  async listPeriods(query: ListPartnerSettlementPeriodsDto) {
    return this.prisma.settlementPeriod.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.agreementId ? { agreementId: query.agreementId } : {})
      },
      include: {
        statement: true,
        payout: true,
        agreement: {
          include: {
            partner: true
          }
        }
      },
      orderBy: { periodStart: 'desc' }
    });
  }

  async report(periodId: string, organizationId: string) {
    const period = await this.prisma.settlementPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        agreement: {
          include: {
            partner: true,
            rules: true
          }
        },
        accrualEntries: true,
        adjustmentEntries: true,
        statement: true,
        payout: true
      }
    });
    if (!period) {
      throw new NotFoundException('Settlement period not found');
    }

    const accruedFromEntries = period.accrualEntries.reduce(
      (sum, entry) => sum + entry.partnerShareCents,
      0
    );
    const adjustmentsFromEntries = period.adjustmentEntries
      .filter((entry) => !entry.carryForward || entry.appliedToPeriodId === period.id)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const totalPayoutCents = period.payout?.amountCents ?? 0;
    const totalAccruedCents = period.statement?.totalAccruedCents ?? accruedFromEntries;
    const totalAdjustmentsCents = period.statement?.totalAdjustmentsCents ?? adjustmentsFromEntries;

    return {
      periodId: period.id,
      partner: {
        id: period.agreement.partner.id,
        name: period.agreement.partner.name
      },
      totals: {
        totalAccruedCents,
        totalAdjustmentsCents,
        totalPayableCents:
          period.statement?.totalPayableCents ??
          Math.max(0, totalAccruedCents + totalAdjustmentsCents),
        payoutAmountCents: totalPayoutCents
      },
      reconciliation: {
        payoutStatus: period.payout?.status ?? 'pending',
        payoutReference: period.payout?.payoutReference ?? null,
        varianceCents: (period.statement?.totalPayableCents ?? 0) - totalPayoutCents
      },
      lifecycle: {
        status: period.status,
        holdReason: period.holdReason,
        reviewedAt: period.reviewedAt,
        approvedAt: period.approvedAt,
        reconciledAt: period.reconciledAt
      },
      entries: {
        accrualCount: period.accrualEntries.length,
        adjustmentCount: period.adjustmentEntries.length
      }
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
