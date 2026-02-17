import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  ReconciliationDiscrepancyStatus,
  ReconciliationDiscrepancyType,
  ReconciliationItemStatus
} from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface ProviderEventRecord {
  id: string;
  organizationId: string;
  invoiceId: string;
  eventId: string;
  provider: string;
  providerRef: string | null;
  amountCents: number;
  currency: string;
  type: string;
  paymentId: string | null;
}

interface ItemDraft {
  organizationId: string;
  invoiceId?: string | undefined;
  paymentId?: string | undefined;
  providerEventId?: string | undefined;
  providerRef?: string | undefined;
  internalAmountCents?: number | undefined;
  providerAmountCents?: number | undefined;
  currency?: string | undefined;
  status: ReconciliationItemStatus;
  discrepancyType?: ReconciliationDiscrepancyType;
  discrepancy?: {
    type: ReconciliationDiscrepancyType;
    amountDeltaCents?: number;
    notes?: string | undefined;
    invoiceId?: string | undefined;
    paymentId?: string | undefined;
    providerEventId?: string | undefined;
  };
}

const EVENT_STATUS_MAP: Record<string, PaymentStatus> = {
  'payment.succeeded': 'succeeded',
  'payment.failed': 'failed',
  'payment.refunded': 'refunded'
};

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async triggerRun(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    actor?: AccessClaims
  ) {
    if (periodEnd <= periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    const [payments, providerEvents] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.paymentWebhookEvent.findMany({
        where: {
          organizationId,
          processedAt: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        orderBy: { processedAt: 'asc' }
      })
    ]);

    const providerRecords = providerEvents.map((event) => this.normalizeProviderEvent(event));
    const providerByRef = new Map<string, ProviderEventRecord[]>();
    const providerByPaymentId = new Map<string, ProviderEventRecord[]>();

    for (const providerEvent of providerRecords) {
      if (providerEvent.providerRef) {
        const key = this.referenceKey(
          providerEvent.provider,
          providerEvent.invoiceId,
          providerEvent.providerRef
        );
        const existing = providerByRef.get(key) ?? [];
        existing.push(providerEvent);
        providerByRef.set(key, existing);
      }

      if (providerEvent.paymentId) {
        const existingByPayment = providerByPaymentId.get(providerEvent.paymentId) ?? [];
        existingByPayment.push(providerEvent);
        providerByPaymentId.set(providerEvent.paymentId, existingByPayment);
      }
    }

    const usedProviderIds = new Set<string>();
    const duplicateRefs = new Set<string>();
    const paymentRefCounts = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.providerRef) {
        continue;
      }
      const key = this.referenceKey(payment.provider, payment.invoiceId, payment.providerRef);
      paymentRefCounts.set(key, (paymentRefCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of paymentRefCounts.entries()) {
      if (count > 1) {
        duplicateRefs.add(key);
      }
    }

    const items: ItemDraft[] = [];

    for (const payment of payments) {
      const providerCandidatesByPayment = providerByPaymentId.get(payment.id) ?? [];
      let providerEvent = providerCandidatesByPayment.find(
        (candidate) => !usedProviderIds.has(candidate.id)
      );

      if (!providerEvent && payment.providerRef) {
        const key = this.referenceKey(payment.provider, payment.invoiceId, payment.providerRef);
        const candidatesByRef = providerByRef.get(key) ?? [];
        providerEvent = candidatesByRef.find((candidate) => !usedProviderIds.has(candidate.id));
      }

      if (providerEvent) {
        usedProviderIds.add(providerEvent.id);
      }

      const duplicateKey = payment.providerRef
        ? this.referenceKey(payment.provider, payment.invoiceId, payment.providerRef)
        : null;
      const isDuplicateSuspected =
        duplicateKey !== null && duplicateRefs.has(duplicateKey) && payment.status === 'succeeded';

      if (isDuplicateSuspected) {
        items.push({
          organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          providerEventId: providerEvent?.id,
          providerRef: payment.providerRef ?? undefined,
          internalAmountCents: payment.amountCents,
          providerAmountCents: providerEvent?.amountCents,
          currency: payment.currency,
          status: 'discrepant',
          discrepancyType: 'DuplicateChargeSuspected',
          discrepancy: {
            type: 'DuplicateChargeSuspected',
            notes: 'Multiple internal payments share the same provider reference',
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            providerEventId: providerEvent?.id
          }
        });
        continue;
      }

      if (!providerEvent) {
        items.push({
          organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          providerRef: payment.providerRef ?? undefined,
          internalAmountCents: payment.amountCents,
          currency: payment.currency,
          status: 'discrepant',
          discrepancyType: 'MissingProviderRecord',
          discrepancy: {
            type: 'MissingProviderRecord',
            invoiceId: payment.invoiceId,
            paymentId: payment.id
          }
        });
        continue;
      }

      const expectedStatus = EVENT_STATUS_MAP[providerEvent.type] ?? 'failed';
      if (payment.currency !== providerEvent.currency) {
        items.push({
          organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          providerEventId: providerEvent.id,
          providerRef: payment.providerRef ?? providerEvent.providerRef ?? undefined,
          internalAmountCents: payment.amountCents,
          providerAmountCents: providerEvent.amountCents,
          currency: payment.currency,
          status: 'discrepant',
          discrepancyType: 'CurrencyMismatch',
          discrepancy: {
            type: 'CurrencyMismatch',
            notes: `Internal=${payment.currency}, Provider=${providerEvent.currency}`,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            providerEventId: providerEvent.id
          }
        });
        continue;
      }

      if (payment.amountCents !== providerEvent.amountCents) {
        items.push({
          organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          providerEventId: providerEvent.id,
          providerRef: payment.providerRef ?? providerEvent.providerRef ?? undefined,
          internalAmountCents: payment.amountCents,
          providerAmountCents: providerEvent.amountCents,
          currency: payment.currency,
          status: 'discrepant',
          discrepancyType: 'AmountMismatch',
          discrepancy: {
            type: 'AmountMismatch',
            amountDeltaCents: payment.amountCents - providerEvent.amountCents,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            providerEventId: providerEvent.id
          }
        });
        continue;
      }

      if (payment.status !== expectedStatus) {
        items.push({
          organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          providerEventId: providerEvent.id,
          providerRef: payment.providerRef ?? providerEvent.providerRef ?? undefined,
          internalAmountCents: payment.amountCents,
          providerAmountCents: providerEvent.amountCents,
          currency: payment.currency,
          status: 'discrepant',
          discrepancyType: 'StatusMismatch',
          discrepancy: {
            type: 'StatusMismatch',
            notes: `Internal=${payment.status}, Provider=${expectedStatus}`,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            providerEventId: providerEvent.id
          }
        });
        continue;
      }

      items.push({
        organizationId,
        invoiceId: payment.invoiceId,
        paymentId: payment.id,
        providerEventId: providerEvent.id,
        providerRef: payment.providerRef ?? providerEvent.providerRef ?? undefined,
        internalAmountCents: payment.amountCents,
        providerAmountCents: providerEvent.amountCents,
        currency: payment.currency,
        status: 'matched'
      });
    }

    for (const providerEvent of providerRecords) {
      if (usedProviderIds.has(providerEvent.id)) {
        continue;
      }

      items.push({
        organizationId,
        invoiceId: providerEvent.invoiceId,
        providerEventId: providerEvent.id,
        providerRef: providerEvent.providerRef ?? undefined,
        providerAmountCents: providerEvent.amountCents,
        currency: providerEvent.currency,
        status: 'discrepant',
        discrepancyType: 'MissingInternalRecord',
        discrepancy: {
          type: 'MissingInternalRecord',
          invoiceId: providerEvent.invoiceId,
          providerEventId: providerEvent.id
        }
      });
    }

    const totalInternalRecords = payments.length;
    const totalProviderRecords = providerRecords.length;
    const matchedCount = items.filter((item) => item.status === 'matched').length;
    const discrepancies = items.filter((item) => item.discrepancy).map((item) => item.discrepancy!);
    const discrepancyCount = discrepancies.length;
    const mismatchAmountCents = discrepancies.reduce(
      (sum, discrepancy) => sum + Math.abs(discrepancy.amountDeltaCents ?? 0),
      0
    );

    const typeBreakdown = this.buildTypeBreakdown(discrepancies.map((item) => item.type));

    const internalSucceededCents = payments
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const internalRefundedCents = payments
      .filter((payment) => payment.status === 'refunded')
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const providerSucceededCents = providerRecords
      .filter((event) => event.type === 'payment.succeeded')
      .reduce((sum, event) => sum + event.amountCents, 0);
    const providerRefundedCents = providerRecords
      .filter((event) => event.type === 'payment.refunded')
      .reduce((sum, event) => sum + event.amountCents, 0);

    const reportJson = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalInternalRecords,
      totalProviderRecords,
      matchedCount,
      discrepancyCount,
      matchedPercentage:
        totalInternalRecords + totalProviderRecords === 0
          ? 1
          : matchedCount / Math.max(1, items.length),
      mismatchAmountCents,
      discrepancyTypeBreakdown: typeBreakdown,
      totals: {
        internalSucceededCents,
        internalRefundedCents,
        providerSucceededCents,
        providerRefundedCents
      }
    };

    const reportMarkdown = this.toMarkdown(reportJson);

    const run = await this.prisma.$transaction(async (tx) => {
      const createdRun = await tx.reconciliationRun.create({
        data: {
          organizationId,
          periodStart,
          periodEnd,
          status: 'completed',
          totalInternalRecords,
          totalProviderRecords,
          matchedCount,
          discrepancyCount,
          mismatchAmountCents,
          reportJson: reportJson as Prisma.InputJsonValue,
          reportMarkdown,
          triggeredByUserId: actor?.sub ?? null,
          completedAt: new Date()
        }
      });

      for (const draft of items) {
        const createdItem = await tx.reconciliationItem.create({
          data: {
            runId: createdRun.id,
            organizationId: draft.organizationId,
            invoiceId: draft.invoiceId ?? null,
            paymentId: draft.paymentId ?? null,
            providerEventId: draft.providerEventId ?? null,
            providerRef: draft.providerRef ?? null,
            internalAmountCents: draft.internalAmountCents ?? null,
            providerAmountCents: draft.providerAmountCents ?? null,
            currency: draft.currency ?? null,
            status: draft.status,
            discrepancyType: draft.discrepancyType ?? null
          }
        });

        if (draft.discrepancy) {
          const createdDiscrepancy = await tx.reconciliationDiscrepancy.create({
            data: {
              runId: createdRun.id,
              itemId: createdItem.id,
              organizationId,
              invoiceId: draft.discrepancy.invoiceId ?? null,
              paymentId: draft.discrepancy.paymentId ?? null,
              providerEventId: draft.discrepancy.providerEventId ?? null,
              type: draft.discrepancy.type,
              amountDeltaCents: draft.discrepancy.amountDeltaCents ?? null,
              notes: draft.discrepancy.notes ?? null
            }
          });

          await tx.reconciliationActionLog.create({
            data: {
              runId: createdRun.id,
              discrepancyId: createdDiscrepancy.id,
              organizationId,
              actorUserId: actor?.sub ?? null,
              action: 'created',
              note: draft.discrepancy.notes ?? null
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'ReconciliationRun',
          entityId: createdRun.id,
          action: 'billing.reconciliation.completed',
          metadata: reportJson as Prisma.InputJsonValue
        }
      });

      return createdRun;
    });

    return this.getRun(run.id, organizationId);
  }

  async runDaily(organizationId: string | undefined, token: string | undefined) {
    if (!this.config.reconciliationDailyToken || token !== this.config.reconciliationDailyToken) {
      throw new ForbiddenException('Invalid reconciliation token');
    }

    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const targetOrganizations = organizationId
      ? [organizationId]
      : (
          await this.prisma.organization.findMany({
            select: { id: true }
          })
        ).map((record) => record.id);

    const runs = [];
    for (const orgId of targetOrganizations) {
      runs.push(await this.triggerRun(orgId, start, end));
    }

    return {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      runsCreated: runs.length,
      runIds: runs.map((run) => run.id)
    };
  }

  async listRuns(organizationId: string, limit = 25) {
    return this.prisma.reconciliationRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        organizationId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        totalInternalRecords: true,
        totalProviderRecords: true,
        matchedCount: true,
        discrepancyCount: true,
        mismatchAmountCents: true,
        createdAt: true,
        completedAt: true
      }
    });
  }

  async listDiscrepancies(query: {
    organizationId: string;
    runId?: string;
    type?: ReconciliationDiscrepancyType;
    status?: ReconciliationDiscrepancyStatus;
  }) {
    return this.prisma.reconciliationDiscrepancy.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.runId ? { runId: query.runId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actionLogs: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async getRun(runId: string, organizationId: string) {
    const run = await this.prisma.reconciliationRun.findFirst({
      where: {
        id: runId,
        organizationId
      },
      include: {
        discrepancies: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!run) {
      throw new NotFoundException('Reconciliation run not found');
    }

    return run;
  }

  async acknowledgeDiscrepancy(
    discrepancyId: string,
    organizationId: string,
    actor?: AccessClaims
  ) {
    const discrepancy = await this.prisma.reconciliationDiscrepancy.findFirst({
      where: { id: discrepancyId, organizationId }
    });
    if (!discrepancy) {
      throw new NotFoundException('Reconciliation discrepancy not found');
    }

    if (discrepancy.status === 'resolved') {
      throw new BadRequestException('Resolved discrepancy cannot be acknowledged');
    }

    const updated = await this.prisma.reconciliationDiscrepancy.update({
      where: { id: discrepancy.id },
      data: {
        status: 'acknowledged',
        acknowledgedByUserId: actor?.sub ?? null,
        acknowledgedAt: new Date()
      }
    });

    await this.logDiscrepancyAction(
      updated.runId,
      updated.id,
      organizationId,
      actor?.sub,
      'acknowledged'
    );
    return updated;
  }

  async assignDiscrepancy(
    discrepancyId: string,
    organizationId: string,
    ownerUserId: string | null,
    note: string | undefined,
    actor?: AccessClaims
  ) {
    const discrepancy = await this.prisma.reconciliationDiscrepancy.findFirst({
      where: { id: discrepancyId, organizationId }
    });
    if (!discrepancy) {
      throw new NotFoundException('Reconciliation discrepancy not found');
    }

    const updated = await this.prisma.reconciliationDiscrepancy.update({
      where: { id: discrepancy.id },
      data: {
        ownerUserId
      }
    });

    await this.logDiscrepancyAction(
      updated.runId,
      updated.id,
      organizationId,
      actor?.sub,
      ownerUserId ? 'assigned' : 'unassigned',
      note,
      ownerUserId ? { ownerUserId } : null
    );

    return updated;
  }

  async addDiscrepancyNote(
    discrepancyId: string,
    organizationId: string,
    note: string,
    actor?: AccessClaims
  ) {
    const discrepancy = await this.prisma.reconciliationDiscrepancy.findFirst({
      where: { id: discrepancyId, organizationId }
    });
    if (!discrepancy) {
      throw new NotFoundException('Reconciliation discrepancy not found');
    }

    const notes = discrepancy.notes ? `${discrepancy.notes}\n${note}` : note;
    const updated = await this.prisma.reconciliationDiscrepancy.update({
      where: { id: discrepancy.id },
      data: { notes }
    });

    await this.logDiscrepancyAction(
      updated.runId,
      updated.id,
      organizationId,
      actor?.sub,
      'note_added',
      note
    );
    return updated;
  }

  async resolveDiscrepancy(
    discrepancyId: string,
    organizationId: string,
    resolutionReason: string,
    note: string | undefined,
    actor?: AccessClaims
  ) {
    const discrepancy = await this.prisma.reconciliationDiscrepancy.findFirst({
      where: { id: discrepancyId, organizationId }
    });
    if (!discrepancy) {
      throw new NotFoundException('Reconciliation discrepancy not found');
    }

    const updated = await this.prisma.reconciliationDiscrepancy.update({
      where: { id: discrepancy.id },
      data: {
        status: 'resolved',
        resolvedByUserId: actor?.sub ?? null,
        resolvedAt: new Date(),
        resolutionReason
      }
    });

    await this.logDiscrepancyAction(
      updated.runId,
      updated.id,
      organizationId,
      actor?.sub,
      'resolved',
      note,
      { resolutionReason }
    );

    return updated;
  }

  private normalizeProviderEvent(event: {
    id: string;
    organizationId: string;
    invoiceId: string;
    eventId: string;
    provider: string;
    paymentId: string | null;
    payload: unknown;
  }): ProviderEventRecord {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const amountCents = typeof payload.amountCents === 'number' ? payload.amountCents : 0;
    const currency = typeof payload.currency === 'string' ? payload.currency : 'USD';
    const providerRef = typeof payload.providerRef === 'string' ? payload.providerRef : null;
    const type = typeof payload.type === 'string' ? payload.type : 'payment.failed';

    return {
      id: event.id,
      organizationId: event.organizationId,
      invoiceId: event.invoiceId,
      eventId: event.eventId,
      provider: event.provider,
      providerRef,
      amountCents,
      currency,
      type,
      paymentId: event.paymentId
    };
  }

  private referenceKey(provider: string, invoiceId: string, providerRef: string) {
    return `${provider}:${invoiceId}:${providerRef}`;
  }

  private buildTypeBreakdown(types: ReconciliationDiscrepancyType[]) {
    const breakdown: Record<ReconciliationDiscrepancyType, number> = {
      MissingInternalRecord: 0,
      MissingProviderRecord: 0,
      AmountMismatch: 0,
      CurrencyMismatch: 0,
      StatusMismatch: 0,
      DuplicateChargeSuspected: 0
    };

    for (const type of types) {
      breakdown[type] += 1;
    }

    return breakdown;
  }

  private toMarkdown(report: {
    periodStart: string;
    periodEnd: string;
    totalInternalRecords: number;
    totalProviderRecords: number;
    matchedCount: number;
    discrepancyCount: number;
    matchedPercentage: number;
    mismatchAmountCents: number;
    discrepancyTypeBreakdown: Record<ReconciliationDiscrepancyType, number>;
    totals: {
      internalSucceededCents: number;
      internalRefundedCents: number;
      providerSucceededCents: number;
      providerRefundedCents: number;
    };
  }) {
    const lines = ['# Billing Reconciliation Report', ''];
    lines.push(`- Period: ${report.periodStart} -> ${report.periodEnd}`);
    lines.push(`- Internal records: ${report.totalInternalRecords}`);
    lines.push(`- Provider records: ${report.totalProviderRecords}`);
    lines.push(`- Matched: ${report.matchedCount}`);
    lines.push(`- Discrepancies: ${report.discrepancyCount}`);
    lines.push(`- Matched %: ${(report.matchedPercentage * 100).toFixed(2)}%`);
    lines.push(`- Total mismatch amount (abs): ${report.mismatchAmountCents} cents`);
    lines.push('');
    lines.push('## Totals');
    lines.push(`- Internal succeeded: ${report.totals.internalSucceededCents} cents`);
    lines.push(`- Internal refunded: ${report.totals.internalRefundedCents} cents`);
    lines.push(`- Provider succeeded: ${report.totals.providerSucceededCents} cents`);
    lines.push(`- Provider refunded: ${report.totals.providerRefundedCents} cents`);
    lines.push('');
    lines.push('## Discrepancies by Type');

    for (const [type, count] of Object.entries(report.discrepancyTypeBreakdown)) {
      lines.push(`- ${type}: ${count}`);
    }

    return lines.join('\n');
  }

  private async logDiscrepancyAction(
    runId: string,
    discrepancyId: string,
    organizationId: string,
    actorUserId: string | undefined,
    action: string,
    note?: string,
    metadata?: Record<string, unknown> | null
  ) {
    await this.prisma.reconciliationActionLog.create({
      data: {
        runId,
        discrepancyId,
        organizationId,
        actorUserId: actorUserId ?? null,
        action,
        note: note ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorUserId ?? null,
        entityType: 'ReconciliationDiscrepancy',
        entityId: discrepancyId,
        action: `billing.reconciliation.discrepancy.${action}`,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull
      }
    });
  }
}
