import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueProducerService } from '../queues/queue.producer.service.js';
import { ApproveBillingAdjustmentDto } from './dto/enterprise/approve-adjustment.dto.js';
import { CancelEnterpriseSubscriptionDto } from './dto/enterprise/cancel-subscription.dto.js';
import { ChangeEnterpriseSeatsDto } from './dto/enterprise/change-seats.dto.js';
import { CloseEnterpriseBillingPeriodDto } from './dto/enterprise/close-period.dto.js';
import { CreateBillingAdjustmentDto } from './dto/enterprise/create-adjustment.dto.js';
import { CreateEnterprisePlanDto } from './dto/enterprise/create-plan.dto.js';
import { CreateEnterpriseSubscriptionDto } from './dto/enterprise/create-subscription.dto.js';
import { EnterpriseBillingReportDto } from './dto/enterprise/enterprise-report.dto.js';
import { IngestEnterpriseUsageDto } from './dto/enterprise/ingest-usage.dto.js';

const LATE_ARRIVAL_GRACE_DAYS = 7;

@Injectable()
export class EnterpriseBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueProducerService,
    private readonly config: AppConfigService
  ) {}

  async createPlan(dto: CreateEnterprisePlanDto, actor?: AccessClaims) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.billingPlan.create({
        data: {
          organizationId: dto.organizationId,
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          billingCycle: dto.billingCycle
        }
      });

      const version = await tx.billingPlanVersion.create({
        data: {
          organizationId: dto.organizationId,
          planId: plan.id,
          versionNumber: 1,
          currency: dto.currency ?? 'USD',
          minimumCommitCents: dto.minimumCommitCents ?? 0,
          effectiveFrom: new Date(dto.effectiveFrom)
        }
      });

      await Promise.all(
        dto.components.map((component) =>
          tx.billingPriceComponent.create({
            data: {
              planVersionId: version.id,
              componentType: component.componentType,
              code: component.code,
              displayName: component.displayName,
              unit: component.unit ?? null,
              unitPriceCents: component.unitPriceCents,
              includedUnits: component.includedUnits ?? 0,
              minimumUnits: component.minimumUnits ?? 0,
              tierJson: component.tierJson
                ? (component.tierJson as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull
            }
          })
        )
      );

      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'BillingPlan',
          entityId: plan.id,
          action: 'billing.plan.created',
          metadata: {
            planCode: plan.code,
            version: 1,
            componentCount: dto.components.length
          }
        }
      });

      return {
        ...plan,
        versionId: version.id
      };
    });
  }

  async createSubscription(dto: CreateEnterpriseSubscriptionDto, actor?: AccessClaims) {
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt value');
    }

    const planVersion = await this.prisma.billingPlanVersion.findFirst({
      where: {
        id: dto.planVersionId,
        planId: dto.planId,
        organizationId: dto.organizationId
      },
      include: {
        components: true,
        plan: true
      }
    });
    if (!planVersion) {
      throw new NotFoundException('Plan version not found');
    }

    const currentPeriodStart = startsAt;
    const currentPeriodEnd = this.nextPeriodEnd(startsAt, planVersion.plan.billingCycle);

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.billingSubscription.create({
        data: {
          organizationId: dto.organizationId,
          clientId: dto.clientId ?? null,
          planId: dto.planId,
          planVersionId: dto.planVersionId,
          status: 'active',
          currency: dto.currency ?? planVersion.currency,
          startsAt,
          currentPeriodStart,
          currentPeriodEnd,
          createdByUserId: actor?.sub ?? null
        }
      });

      const seatComponents = planVersion.components.filter(
        (component) => component.componentType === 'seat'
      );
      await Promise.all(
        seatComponents.map((component) =>
          tx.billingSubscriptionItem.create({
            data: {
              subscriptionId: subscription.id,
              componentId: component.id,
              quantity: Math.max(0, dto.seatQuantities?.[component.code] ?? 0)
            }
          })
        )
      );

      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'BillingSubscription',
          entityId: subscription.id,
          action: 'billing.subscription.created',
          metadata: {
            planId: dto.planId,
            planVersionId: dto.planVersionId,
            currentPeriodStart,
            currentPeriodEnd
          }
        }
      });

      return subscription;
    });
  }

  async changeSeats(subscriptionId: string, dto: ChangeEnterpriseSeatsDto, actor?: AccessClaims) {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId: dto.organizationId
      },
      include: {
        planVersion: {
          include: {
            components: true
          }
        },
        items: {
          include: {
            component: true
          }
        }
      }
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (subscription.status !== 'active') {
      throw new BadRequestException('Subscription is not active');
    }

    const seatComponent = subscription.planVersion.components.find(
      (component) =>
        component.componentType === 'seat' &&
        (dto.componentCode ? component.code === dto.componentCode : true)
    );
    if (!seatComponent) {
      throw new NotFoundException('Seat component not found on plan');
    }

    const currentItem = subscription.items.find((item) => item.componentId === seatComponent.id);
    const fromQuantity = currentItem?.quantity ?? 0;
    const toQuantity = dto.quantity;

    const totalPeriodMs =
      subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime();
    const remainingMs = Math.max(subscription.currentPeriodEnd.getTime() - Date.now(), 0);
    const remainingRatio = totalPeriodMs > 0 ? remainingMs / totalPeriodMs : 0;

    const prorationDeltaCents = Math.round(
      (toQuantity - fromQuantity) * seatComponent.unitPriceCents * remainingRatio
    );

    return this.prisma.$transaction(async (tx) => {
      if (currentItem) {
        await tx.billingSubscriptionItem.update({
          where: { id: currentItem.id },
          data: { quantity: toQuantity }
        });
      } else {
        await tx.billingSubscriptionItem.create({
          data: {
            subscriptionId,
            componentId: seatComponent.id,
            quantity: toQuantity
          }
        });
      }

      const seatChange = await tx.billingSubscriptionSeatChangeLog.create({
        data: {
          organizationId: dto.organizationId,
          subscriptionId,
          fromQuantity,
          toQuantity,
          prorationDeltaCents,
          changedByUserId: actor?.sub ?? null
        }
      });

      if (prorationDeltaCents !== 0) {
        await tx.billingAdjustmentRequest.create({
          data: {
            organizationId: dto.organizationId,
            subscriptionId,
            amountCents: prorationDeltaCents,
            reason: 'Seat proration adjustment',
            status: 'pending_approval',
            requestedByUserId: actor?.sub ?? null,
            metadata: {
              fromQuantity,
              toQuantity,
              remainingRatio
            }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'BillingSubscription',
          entityId: subscriptionId,
          action: 'billing.subscription.seats.changed',
          metadata: {
            fromQuantity,
            toQuantity,
            prorationDeltaCents
          }
        }
      });

      return seatChange;
    });
  }

  async ingestUsage(subscriptionId: string, dto: IngestEnterpriseUsageDto, actor?: AccessClaims) {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: { id: subscriptionId, organizationId: dto.organizationId }
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const usageAt = new Date(dto.usageAt);
    if (Number.isNaN(usageAt.getTime())) {
      throw new BadRequestException('Invalid usageAt value');
    }

    const latestAllowed = new Date(
      subscription.currentPeriodEnd.getTime() + LATE_ARRIVAL_GRACE_DAYS * 24 * 60 * 60 * 1000
    );
    if (usageAt > latestAllowed) {
      throw new BadRequestException('Usage record is outside late-arrival policy window');
    }

    let meter = await this.prisma.billingMeter.findFirst({
      where: {
        organizationId: dto.organizationId,
        code: dto.meterCode
      }
    });
    if (!meter) {
      meter = await this.prisma.billingMeter.create({
        data: {
          organizationId: dto.organizationId,
          code: dto.meterCode,
          unit: dto.meterCode
        }
      });
    }

    try {
      const created = await this.prisma.billingUsageRecord.create({
        data: {
          organizationId: dto.organizationId,
          subscriptionId,
          meterId: meter.id,
          quantity: dto.quantity,
          usageAt,
          dedupKey: dto.dedupKey,
          source: dto.source ?? 'api',
          correctionOfId: dto.correctionOfId ?? null,
          ingestedByUserId: actor?.sub ?? null
        }
      });

      if (dto.quantity >= this.config.billingUsageAnomalyThreshold) {
        await this.prisma.auditLog.create({
          data: {
            organizationId: dto.organizationId,
            actorUserId: actor?.sub ?? null,
            entityType: 'BillingUsageRecord',
            entityId: created.id,
            action: 'billing.usage.anomaly',
            metadata: {
              quantity: dto.quantity,
              threshold: this.config.billingUsageAnomalyThreshold,
              meterCode: dto.meterCode
            }
          }
        });

        await this.queues.enqueueNotification({
          recipientUserId: actor?.sub ?? 'billing-ops',
          channel: 'email',
          template: 'billing-usage-anomaly',
          variables: {
            organizationId: dto.organizationId,
            subscriptionId,
            meterCode: dto.meterCode,
            quantity: dto.quantity.toString()
          }
        });
      }

      return {
        duplicate: false,
        record: created
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.billingUsageRecord.findFirst({
          where: {
            organizationId: dto.organizationId,
            dedupKey: dto.dedupKey
          }
        });
        if (!existing) {
          throw new ConflictException('Duplicate usage ingestion key');
        }

        return {
          duplicate: true,
          record: existing
        };
      }
      throw error;
    }
  }

  async closePeriod(
    subscriptionId: string,
    dto: CloseEnterpriseBillingPeriodDto,
    actor?: AccessClaims
  ) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime()) ||
      periodStart >= periodEnd
    ) {
      throw new BadRequestException('Invalid period range');
    }

    const subscription = await this.prisma.billingSubscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId: dto.organizationId
      },
      include: {
        planVersion: { include: { components: true, plan: true } },
        items: true,
        usageRecords: {
          where: {
            usageAt: {
              gte: periodStart,
              lt: periodEnd
            }
          },
          include: {
            meter: true
          }
        }
      }
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    if (!subscription.clientId) {
      throw new BadRequestException('Subscription must be linked to a client for invoicing');
    }

    const lines: Array<{
      componentId?: string;
      lineType: string;
      description: string;
      quantity: number;
      unitPriceCents: number;
      amountCents: number;
    }> = [];

    for (const component of subscription.planVersion.components) {
      if (component.componentType === 'fixed') {
        lines.push({
          componentId: component.id,
          lineType: 'fixed',
          description: component.displayName,
          quantity: 1,
          unitPriceCents: component.unitPriceCents,
          amountCents: component.unitPriceCents
        });
        continue;
      }

      if (component.componentType === 'seat') {
        const item = subscription.items.find((entry) => entry.componentId === component.id);
        const quantity = item?.quantity ?? 0;
        lines.push({
          componentId: component.id,
          lineType: 'seat',
          description: component.displayName,
          quantity,
          unitPriceCents: component.unitPriceCents,
          amountCents: quantity * component.unitPriceCents
        });
        continue;
      }

      const usageUnits = subscription.usageRecords
        .filter((entry) => entry.meter.code === component.code)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const billableUnits = Math.max(usageUnits, component.minimumUnits ?? 0);
      const chargeableUnits = Math.max(billableUnits - (component.includedUnits ?? 0), 0);

      lines.push({
        componentId: component.id,
        lineType: 'usage',
        description: component.displayName,
        quantity: chargeableUnits,
        unitPriceCents: component.unitPriceCents,
        amountCents: chargeableUnits * component.unitPriceCents
      });
    }

    let subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    let trueUpAmountCents = 0;
    if (subtotalCents < subscription.planVersion.minimumCommitCents) {
      trueUpAmountCents = subscription.planVersion.minimumCommitCents - subtotalCents;
      lines.push({
        lineType: 'true_up',
        description: 'Minimum commit true-up',
        quantity: 1,
        unitPriceCents: trueUpAmountCents,
        amountCents: trueUpAmountCents
      });
      subtotalCents += trueUpAmountCents;
    }

    if (subtotalCents < 0) {
      throw new BadRequestException('Negative invoice totals are not allowed');
    }

    const invoiceNumber = `SUB-${subscription.id.slice(-6).toUpperCase()}-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organizationId: dto.organizationId,
          clientId: subscription.clientId!,
          invoiceNumber,
          status: 'issued',
          subtotalCents,
          taxCents: 0,
          totalCents: subtotalCents,
          issuedAt: new Date(),
          dueAt: subscription.currentPeriodEnd
        }
      });

      await Promise.all(
        lines.map((line) =>
          tx.billingInvoiceLine.create({
            data: {
              organizationId: dto.organizationId,
              invoiceId: invoice.id,
              subscriptionId: subscription.id,
              componentId: line.componentId ?? null,
              lineType: line.lineType,
              description: line.description,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              amountCents: line.amountCents,
              periodStart,
              periodEnd
            }
          })
        )
      );

      const trueUp = await tx.billingTrueUpRecord.create({
        data: {
          organizationId: dto.organizationId,
          subscriptionId: subscription.id,
          periodStart,
          periodEnd,
          amountCents: trueUpAmountCents,
          status: 'invoiced',
          generatedInvoiceId: invoice.id,
          metadata: {
            lineItemCount: lines.length
          }
        }
      });

      const nextPeriodStart = periodEnd;
      const nextPeriodEnd = this.nextPeriodEnd(
        periodEnd,
        subscription.planVersion.plan.billingCycle
      );
      await tx.billingSubscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: dto.organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'BillingSubscription',
          entityId: subscription.id,
          action: 'billing.subscription.period.closed',
          metadata: {
            periodStart,
            periodEnd,
            invoiceId: invoice.id,
            subtotalCents,
            trueUpAmountCents
          }
        }
      });

      return {
        invoice,
        trueUp,
        lines
      };
    });
  }

  async cancelSubscription(
    subscriptionId: string,
    dto: CancelEnterpriseSubscriptionDto,
    actor?: AccessClaims
  ) {
    const subscription = await this.prisma.billingSubscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId: dto.organizationId
      }
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const updated = await this.prisma.billingSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'BillingSubscription',
        entityId: subscriptionId,
        action: 'billing.subscription.cancelled',
        metadata: {
          reason: dto.reason ?? null
        }
      }
    });

    return updated;
  }

  async createAdjustment(dto: CreateBillingAdjustmentDto, actor?: AccessClaims) {
    if (!dto.subscriptionId && !dto.invoiceId) {
      throw new BadRequestException('subscriptionId or invoiceId is required');
    }

    const adjustment = await this.prisma.billingAdjustmentRequest.create({
      data: {
        organizationId: dto.organizationId,
        subscriptionId: dto.subscriptionId ?? null,
        invoiceId: dto.invoiceId ?? null,
        amountCents: dto.amountCents,
        reason: dto.reason,
        status: 'pending_approval',
        requestedByUserId: actor?.sub ?? null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'BillingAdjustmentRequest',
        entityId: adjustment.id,
        action: 'billing.adjustment.requested',
        metadata: {
          amountCents: dto.amountCents,
          reason: dto.reason
        }
      }
    });

    return adjustment;
  }

  async approveAdjustment(
    adjustmentId: string,
    dto: ApproveBillingAdjustmentDto,
    actor?: AccessClaims
  ) {
    const adjustment = await this.prisma.billingAdjustmentRequest.findFirst({
      where: {
        id: adjustmentId,
        organizationId: dto.organizationId
      }
    });
    if (!adjustment) {
      throw new NotFoundException('Adjustment request not found');
    }

    const updated = await this.prisma.billingAdjustmentRequest.update({
      where: { id: adjustment.id },
      data: {
        status: dto.status,
        approvedByUserId: actor?.sub ?? null,
        approvedAt: new Date(),
        metadata: {
          ...(adjustment.metadata && typeof adjustment.metadata === 'object'
            ? adjustment.metadata
            : {}),
          approvalNote: dto.note ?? null
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'BillingAdjustmentRequest',
        entityId: adjustment.id,
        action: `billing.adjustment.${dto.status}`,
        metadata: {
          note: dto.note ?? null
        }
      }
    });

    return updated;
  }

  async listSubscriptionHistory(subscriptionId: string, organizationId: string) {
    const [subscription, seatChanges, trueUps, adjustments, audits] = await Promise.all([
      this.prisma.billingSubscription.findFirst({
        where: { id: subscriptionId, organizationId },
        include: {
          items: {
            include: { component: true }
          },
          plan: true,
          planVersion: true
        }
      }),
      this.prisma.billingSubscriptionSeatChangeLog.findMany({
        where: { subscriptionId, organizationId },
        orderBy: { changedAt: 'desc' }
      }),
      this.prisma.billingTrueUpRecord.findMany({
        where: { subscriptionId, organizationId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.billingAdjustmentRequest.findMany({
        where: { subscriptionId, organizationId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          entityType: 'BillingSubscription',
          entityId: subscriptionId
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      subscription,
      seatChanges,
      trueUps,
      adjustments,
      auditTrail: audits
    };
  }

  async enterpriseReport(query: EnterpriseBillingReportDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const subscriptions = await this.prisma.billingSubscription.findMany({
      where: {
        organizationId: query.organizationId
      },
      include: {
        items: {
          include: { component: true }
        },
        plan: true,
        planVersion: true
      }
    });

    const invoiceLines = await this.prisma.billingInvoiceLine.findMany({
      where: {
        organizationId: query.organizationId,
        createdAt: {
          gte: from,
          lte: to
        }
      }
    });

    const seatUtilization = subscriptions.map((subscription) => {
      const seats = subscription.items
        .filter((item) => item.component.componentType === 'seat')
        .reduce((sum, item) => sum + item.quantity, 0);
      return {
        subscriptionId: subscription.id,
        seats
      };
    });

    const mrr = subscriptions
      .filter(
        (subscription) =>
          subscription.status === 'active' && subscription.plan.billingCycle === 'monthly'
      )
      .reduce((sum, subscription) => {
        const fixedAndSeat = subscription.items.reduce((inner, item) => {
          if (item.component.componentType === 'usage') {
            return inner;
          }
          return inner + item.quantity * item.component.unitPriceCents;
        }, 0);
        return sum + fixedAndSeat + subscription.planVersion.minimumCommitCents;
      }, 0);

    const arr = mrr * 12;

    const billedUsageCents = invoiceLines
      .filter((line) => line.lineType === 'usage')
      .reduce((sum, line) => sum + line.amountCents, 0);

    const recognizedUsageCents = invoiceLines.reduce((sum, line) => sum + line.amountCents, 0);

    return {
      range: {
        from,
        to
      },
      mrrCents: mrr,
      arrCents: arr,
      billedVsRecognizedUsage: {
        billedUsageCents,
        recognizedUsageCents
      },
      seatUtilization
    };
  }

  private nextPeriodEnd(startsAt: Date, billingCycle: 'monthly' | 'annual') {
    const next = new Date(startsAt);
    if (billingCycle === 'annual') {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    }

    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
}
