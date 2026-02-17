import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { PricingExperimentsService } from './pricing-experiments.service.js';

const ONBOARDING_STEP_BY_EVENT: Record<string, string> = {
  lead_created: 'first_lead_created',
  quote_sent: 'first_quote_sent',
  booking_created: 'first_booking_created',
  rental_reserved: 'first_rental_reserved',
  invoice_issued: 'first_invoice_issued'
};

interface RecordEventInput {
  organizationId: string;
  eventName: string;
  actorRole: string;
  source: 'web' | 'mobile' | 'api';
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
  idempotencyKey?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingExperiments: PricingExperimentsService
  ) {}

  async recordEvent(input: RecordEventInput): Promise<void> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.analyticsEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true }
      });
      if (existing) {
        return;
      }
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { pilotOrg: true, pilotCohortId: true }
    });

    const created = await this.prisma.analyticsEvent.create({
      data: {
        organizationId: input.organizationId,
        eventName: input.eventName,
        actorRole: input.actorRole,
        source: input.source,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        idempotencyKey: input.idempotencyKey ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        pilotOrg: organization?.pilotOrg ?? false,
        pilotCohortId: organization?.pilotCohortId ?? null
      }
    });

    const payload =
      created.payload === null || typeof created.payload !== 'object'
        ? null
        : (created.payload as Record<string, unknown>);

    await this.pricingExperiments.linkConversionForAnalyticsEvent({
      id: created.id,
      organizationId: created.organizationId,
      eventName: created.eventName,
      occurredAt: created.occurredAt,
      entityType: created.entityType,
      entityId: created.entityId,
      payload
    });

    const onboardingStep = ONBOARDING_STEP_BY_EVENT[created.eventName];
    if (onboardingStep) {
      await this.recordEvent({
        organizationId: created.organizationId,
        eventName: onboardingStep,
        actorRole: created.actorRole,
        source: created.source as 'web' | 'mobile' | 'api',
        ...(created.entityType ? { entityType: created.entityType } : {}),
        ...(created.entityId ? { entityId: created.entityId } : {}),
        occurredAt: created.occurredAt,
        idempotencyKey: `onboarding:${onboardingStep}:${created.organizationId}`
      });
    }
  }

  async getPilotKpis(filters: { organizationId?: string; pilotCohortId?: string; days: number }) {
    const from = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        occurredAt: { gte: from },
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      orderBy: { occurredAt: 'asc' }
    });

    const count = (name: string) => events.filter((event) => event.eventName === name).length;

    const leadCreated = count('lead_created');
    const leadConverted = count('lead_converted');
    const bookingCreated = count('booking_created');
    const bookingConflict = count('booking_conflict_detected');
    const rentalReserved = count('rental_reserved');
    const rentalReturned = count('rental_returned');
    const incidentCreated = count('incident_created');

    const issuedByInvoice = new Map<string, Date>();
    const paidByInvoice = new Map<string, Date>();
    for (const event of events) {
      if (!event.entityId) {
        continue;
      }
      if (event.eventName === 'invoice_issued') {
        issuedByInvoice.set(event.entityId, event.occurredAt);
      }
      if (event.eventName === 'invoice_paid') {
        paidByInvoice.set(event.entityId, event.occurredAt);
      }
    }

    const dsoDays: number[] = [];
    for (const [invoiceId, issuedAt] of issuedByInvoice.entries()) {
      const paidAt = paidByInvoice.get(invoiceId);
      if (!paidAt) {
        continue;
      }
      dsoDays.push((paidAt.getTime() - issuedAt.getTime()) / (24 * 60 * 60 * 1000));
    }

    const quoteSentById = new Map<string, Date>();
    const turnaroundHours: number[] = [];
    for (const event of events) {
      if (!event.entityId) {
        continue;
      }
      if (event.eventName === 'quote_sent') {
        quoteSentById.set(event.entityId, event.occurredAt);
      }
      if (event.eventName === 'quote_accepted') {
        const sentAt = quoteSentById.get(event.entityId);
        if (sentAt) {
          turnaroundHours.push((event.occurredAt.getTime() - sentAt.getTime()) / (60 * 60 * 1000));
        }
      }
    }

    const trend = this.buildTrend(events, filters.days);

    return {
      windowDays: filters.days,
      totals: {
        leadCreated,
        leadConverted,
        bookingCreated,
        bookingConflict,
        rentalReserved,
        rentalReturned,
        incidentCreated,
        invoiceIssued: count('invoice_issued'),
        invoicePaid: count('invoice_paid'),
        invoiceOverdue: count('invoice_overdue')
      },
      kpis: {
        leadToBookingConversionRate: leadCreated > 0 ? bookingCreated / leadCreated : 0,
        medianResponseTurnaroundHours: this.median(turnaroundHours),
        bookingConflictRate: bookingCreated > 0 ? bookingConflict / bookingCreated : 0,
        onTimeDeliveryRate: rentalReserved > 0 ? rentalReturned / rentalReserved : 0,
        rentalUtilizationRate: rentalReserved > 0 ? rentalReturned / rentalReserved : 0,
        incidentRate: rentalReserved > 0 ? incidentCreated / rentalReserved : 0,
        dsoDays: this.median(dsoDays)
      },
      trend
    };
  }

  async getDataQuality(filters: { organizationId?: string; pilotCohortId?: string; days: number }) {
    const from = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        occurredAt: { gte: from },
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      }
    });

    const missingRequired = events.filter(
      (event) =>
        !event.organizationId ||
        !event.eventName ||
        !event.actorRole ||
        !event.source ||
        !event.occurredAt
    ).length;

    const keyCounts = new Map<string, number>();
    for (const event of events) {
      if (!event.idempotencyKey) {
        continue;
      }
      keyCounts.set(event.idempotencyKey, (keyCounts.get(event.idempotencyKey) ?? 0) + 1);
    }

    const duplicateKeys = [...keyCounts.values()].filter((value) => value > 1).length;

    return {
      totalEvents: events.length,
      missingRequiredFields: missingRequired,
      duplicateIdempotencyKeys: duplicateKeys
    };
  }

  private median(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
    }
    return sorted[middle] ?? 0;
  }

  private buildTrend(
    events: Array<{ occurredAt: Date; eventName: string }>,
    days: number
  ): Array<Record<string, string | number>> {
    const dayMap = new Map<string, Record<string, number>>();

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const day = new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dayMap.set(day, {});
    }

    for (const event of events) {
      const day = event.occurredAt.toISOString().slice(0, 10);
      const bucket = dayMap.get(day);
      if (!bucket) {
        continue;
      }
      bucket[event.eventName] = (bucket[event.eventName] ?? 0) + 1;
    }

    return [...dayMap.entries()].map(([day, bucket]) => ({ day, ...bucket }));
  }
}
