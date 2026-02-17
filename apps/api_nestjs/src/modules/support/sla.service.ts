import { Injectable } from '@nestjs/common';
import { SlaBreachState, SupportTicketStatus } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SupportSlaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async initializeTicketSla(input: {
    ticketId: string;
    organizationId: string;
    severity: 'p0' | 'p1' | 'p2' | 'p3';
    startedAt: Date;
  }) {
    const firstResponseMinutes = this.config.getSupportFirstResponseTargetMinutes(input.severity);
    const resolutionMinutes = this.config.getSupportResolutionTargetMinutes(input.severity);

    const firstResponseDueAt = this.addBusinessAwareMinutes(input.startedAt, firstResponseMinutes);
    const resolutionDueAt = this.addBusinessAwareMinutes(input.startedAt, resolutionMinutes);

    return this.prisma.supportTicketSla.create({
      data: {
        ticketId: input.ticketId,
        policyVersion: this.config.slaPolicyVersion,
        businessHoursOnly: this.config.slaBusinessHoursOnly,
        firstResponseTargetMinutes: firstResponseMinutes,
        resolutionTargetMinutes: resolutionMinutes,
        clockStartedAt: input.startedAt,
        firstResponseDueAt,
        resolutionDueAt,
        lastEvaluatedAt: input.startedAt
      }
    });
  }

  async markFirstResponse(ticketId: string, occurredAt = new Date()) {
    const current = await this.prisma.supportTicketSla.findUnique({ where: { ticketId } });
    if (!current || current.firstResponseAt) {
      return;
    }

    await this.prisma.supportTicketSla.update({
      where: { ticketId },
      data: {
        firstResponseAt: occurredAt,
        firstResponseBreachedAt:
          occurredAt > current.firstResponseDueAt
            ? (current.firstResponseBreachedAt ?? occurredAt)
            : null,
        lastEvaluatedAt: occurredAt
      }
    });

    await this.evaluateAndAlert(ticketId, occurredAt);
  }

  async onStatusChanged(
    ticketId: string,
    previous: SupportTicketStatus,
    next: SupportTicketStatus
  ) {
    const now = new Date();
    const current = await this.prisma.supportTicketSla.findUnique({ where: { ticketId } });
    if (!current) {
      return;
    }

    const data: {
      resolvedAt?: Date | null;
      pausedAt?: Date | null;
      totalPausedSeconds?: number;
      resolutionBreachedAt?: Date | null;
      state?: SlaBreachState;
      lastEvaluatedAt?: Date;
    } = { lastEvaluatedAt: now };

    const isResolved = next === 'resolved' || next === 'closed';
    const wasResolved = previous === 'resolved' || previous === 'closed';

    if (isResolved && !current.resolvedAt) {
      data.resolvedAt = now;
      if (now > current.resolutionDueAt) {
        data.resolutionBreachedAt = current.resolutionBreachedAt ?? now;
      }
      if (current.state === 'breached') {
        data.state = 'recovered';
      }
    }

    if (wasResolved && !isResolved && current.resolvedAt) {
      data.resolvedAt = null;
    }

    if (!wasResolved && isResolved) {
      data.pausedAt = now;
    }
    if (wasResolved && !isResolved && current.pausedAt) {
      data.totalPausedSeconds =
        current.totalPausedSeconds +
        Math.floor((now.getTime() - current.pausedAt.getTime()) / 1000);
      data.pausedAt = null;
    }

    await this.prisma.supportTicketSla.update({ where: { ticketId }, data });
    await this.evaluateAndAlert(ticketId, now);
  }

  async getDashboard(organizationId: string, days = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await this.prisma.supportTicketSla.findMany({
      where: {
        ticket: { organizationId },
        createdAt: { gte: from }
      },
      include: {
        ticket: { select: { severity: true, createdAt: true, status: true } }
      }
    });

    const bySeverity = new Map<
      string,
      { total: number; compliant: number; mtta: number[]; mttr: number[] }
    >();
    const weeklyBreach = new Map<string, number>();

    for (const row of records) {
      const severity = row.ticket.severity;
      if (!bySeverity.has(severity)) {
        bySeverity.set(severity, { total: 0, compliant: 0, mtta: [], mttr: [] });
      }

      const bucket = bySeverity.get(severity) as {
        total: number;
        compliant: number;
        mtta: number[];
        mttr: number[];
      };
      bucket.total += 1;

      const firstResponseBreached = row.firstResponseBreachedAt !== null;
      const resolutionBreached = row.resolutionBreachedAt !== null;
      if (!firstResponseBreached && !resolutionBreached) {
        bucket.compliant += 1;
      }

      if (row.firstResponseAt) {
        bucket.mtta.push(
          (row.firstResponseAt.getTime() - row.clockStartedAt.getTime()) / (60 * 1000)
        );
      }
      if (row.resolvedAt) {
        bucket.mttr.push((row.resolvedAt.getTime() - row.clockStartedAt.getTime()) / (60 * 1000));
      }

      if (resolutionBreached || firstResponseBreached) {
        const key = this.weekKey(row.lastEvaluatedAt);
        weeklyBreach.set(key, (weeklyBreach.get(key) ?? 0) + 1);
      }
    }

    return {
      windowDays: days,
      bySeverity: [...bySeverity.entries()].map(([severity, data]) => ({
        severity,
        complianceRate: data.total > 0 ? data.compliant / data.total : 0,
        totalTickets: data.total,
        mttaMinutes: this.median(data.mtta),
        mttrMinutes: this.median(data.mttr)
      })),
      breachTrend: [...weeklyBreach.entries()].map(([week, breaches]) => ({ week, breaches }))
    };
  }

  async getWeeklyReport(organizationId: string, days = 7) {
    const dashboard = await this.getDashboard(organizationId, days);

    const workflow = await this.computeWorkflowSla(organizationId, days);

    return {
      generatedAt: new Date().toISOString(),
      organizationId,
      windowDays: days,
      support: dashboard,
      workflows: workflow
    };
  }

  private async evaluateAndAlert(ticketId: string, now: Date) {
    const current = await this.prisma.supportTicketSla.findUnique({ where: { ticketId } });
    if (!current) {
      return;
    }

    let state: SlaBreachState = current.state;

    const firstResponsePending = !current.firstResponseAt;
    const resolutionPending = !current.resolvedAt;

    const firstResponseBreached = firstResponsePending && now > current.firstResponseDueAt;
    const resolutionBreached = resolutionPending && now > current.resolutionDueAt;

    const nearFirstResponse =
      firstResponsePending &&
      !firstResponseBreached &&
      now.getTime() >=
        current.firstResponseDueAt.getTime() - 0.1 * current.firstResponseTargetMinutes * 60 * 1000;
    const nearResolution =
      resolutionPending &&
      !resolutionBreached &&
      now.getTime() >=
        current.resolutionDueAt.getTime() - 0.1 * current.resolutionTargetMinutes * 60 * 1000;

    if (firstResponseBreached || resolutionBreached) {
      state = 'breached';
    } else if (nearFirstResponse || nearResolution) {
      state = state === 'breached' ? 'breached' : 'at_risk';
    } else if (current.resolvedAt && current.state === 'breached') {
      state = 'recovered';
    } else {
      state = current.state === 'recovered' ? 'recovered' : 'healthy';
    }

    const updated = await this.prisma.supportTicketSla.update({
      where: { ticketId },
      data: {
        state,
        firstResponseBreachedAt:
          firstResponseBreached && !current.firstResponseBreachedAt
            ? now
            : current.firstResponseBreachedAt,
        resolutionBreachedAt:
          resolutionBreached && !current.resolutionBreachedAt ? now : current.resolutionBreachedAt,
        lastEvaluatedAt: now
      },
      include: { ticket: true }
    });

    if (
      this.config.slaAlertWebhookUrl &&
      (current.state !== updated.state ||
        (!current.firstResponseBreachedAt && updated.firstResponseBreachedAt !== null) ||
        (!current.resolutionBreachedAt && updated.resolutionBreachedAt !== null))
    ) {
      try {
        await fetch(this.config.slaAlertWebhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ticketId: updated.ticketId,
            organizationId: updated.ticket.organizationId,
            severity: updated.ticket.severity,
            state: updated.state,
            firstResponseBreachedAt: updated.firstResponseBreachedAt,
            resolutionBreachedAt: updated.resolutionBreachedAt
          })
        });
      } catch {
        // Best-effort alerting only.
      }
    }
  }

  private addBusinessAwareMinutes(start: Date, minutes: number): Date {
    if (!this.config.slaBusinessHoursOnly) {
      return new Date(start.getTime() + minutes * 60 * 1000);
    }

    let remaining = minutes;
    let cursor = new Date(start);

    while (remaining > 0) {
      if (this.isBusinessHour(cursor)) {
        cursor = new Date(cursor.getTime() + 60 * 1000);
        remaining -= 1;
      } else {
        cursor = new Date(cursor.getTime() + 60 * 1000);
      }
    }

    return cursor;
  }

  private isBusinessHour(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) {
      return false;
    }

    const hour = date.getHours();
    return hour >= this.config.slaBusinessHourStart && hour < this.config.slaBusinessHourEnd;
  }

  private weekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const delta = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
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

  private async computeWorkflowSla(organizationId: string, days: number) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: from },
        eventName: { in: ['lead_created', 'quote_sent', 'quote_accepted', 'booking_created'] }
      },
      orderBy: { occurredAt: 'asc' }
    });

    const leadCreated = events.filter((event) => event.eventName === 'lead_created');
    const quoteSent = events.filter((event) => event.eventName === 'quote_sent');
    const quoteAccepted = events.filter((event) => event.eventName === 'quote_accepted');
    const bookingCreated = events.filter((event) => event.eventName === 'booking_created');

    const quoteResponseWithinTarget = Math.min(leadCreated.length, quoteSent.length);
    const bookingConfirmationWithinTarget = Math.min(quoteAccepted.length, bookingCreated.length);

    return {
      quoteResponseSlaMinutes: this.config.slaQuoteResponseMinutes,
      bookingConfirmationSlaMinutes: this.config.slaBookingConfirmationMinutes,
      quoteResponseObservedPairs: quoteResponseWithinTarget,
      bookingConfirmationObservedPairs: bookingConfirmationWithinTarget
    };
  }
}
