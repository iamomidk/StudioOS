import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnalyticsService } from './analytics.service.js';

const DERIVED_STEP_BY_EVENT: Record<string, string> = {
  lead_created: 'first_lead_created',
  quote_sent: 'first_quote_sent',
  booking_created: 'first_booking_created',
  rental_reserved: 'first_rental_reserved',
  invoice_issued: 'first_invoice_issued'
};

@Injectable()
export class OnboardingFunnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly analytics: AnalyticsService
  ) {}

  async getFunnel(filters: { organizationId?: string; pilotCohortId?: string; days: number }) {
    await this.ensureDerivedStepEvents(filters);

    const steps = this.config.onboardingSteps;
    const requiredActivationSteps = this.config.activationRequiredSteps;
    const from = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);

    const organizations = await this.prisma.organization.findMany({
      where: {
        ...(filters.organizationId ? { id: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      select: {
        id: true,
        pilotCohortId: true
      }
    });

    const stepEvents = await this.prisma.analyticsEvent.findMany({
      where: {
        eventName: { in: steps },
        occurredAt: { gte: from },
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      orderBy: [{ organizationId: 'asc' }, { occurredAt: 'asc' }],
      select: {
        organizationId: true,
        eventName: true,
        occurredAt: true,
        pilotCohortId: true
      }
    });

    const orgStepTimes = new Map<string, Map<string, Date>>();
    for (const event of stepEvents) {
      if (!orgStepTimes.has(event.organizationId)) {
        orgStepTimes.set(event.organizationId, new Map<string, Date>());
      }
      const stepMap = orgStepTimes.get(event.organizationId) as Map<string, Date>;
      if (!stepMap.has(event.eventName)) {
        stepMap.set(event.eventName, event.occurredAt);
      }
    }

    const totalOrgs = organizations.length;
    const stepCompletionCounts = new Map<string, number>();
    const stepTransitionHours = new Map<string, number[]>();

    for (const step of steps) {
      stepCompletionCounts.set(step, 0);
    }

    let outOfOrderEvents = 0;
    let missingStepAnomalies = 0;

    for (const organization of organizations) {
      const stepMap = orgStepTimes.get(organization.id) ?? new Map<string, Date>();
      let sawGap = false;

      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index] as string;
        const completedAt = stepMap.get(step);
        if (completedAt) {
          stepCompletionCounts.set(step, (stepCompletionCounts.get(step) ?? 0) + 1);
        }

        if (index > 0) {
          const previousStep = steps[index - 1] as string;
          const previousAt = stepMap.get(previousStep);
          if (previousAt && completedAt) {
            if (completedAt < previousAt) {
              outOfOrderEvents += 1;
            }
            const transitionKey = `${previousStep}->${step}`;
            if (!stepTransitionHours.has(transitionKey)) {
              stepTransitionHours.set(transitionKey, []);
            }
            stepTransitionHours
              .get(transitionKey)
              ?.push((completedAt.getTime() - previousAt.getTime()) / (60 * 60 * 1000));
          }

          if (!previousAt && completedAt) {
            sawGap = true;
          }
        }
      }

      if (sawGap) {
        missingStepAnomalies += 1;
      }
    }

    const stepSummaries = steps.map((step, index) => {
      const completed = stepCompletionCounts.get(step) ?? 0;
      const previousStep = index > 0 ? (steps[index - 1] as string) : null;
      const previousCompleted = previousStep
        ? (stepCompletionCounts.get(previousStep) ?? 0)
        : totalOrgs;
      const transitionKey = previousStep ? `${previousStep}->${step}` : null;
      const transitionSamples = transitionKey ? (stepTransitionHours.get(transitionKey) ?? []) : [];

      return {
        step,
        completedOrgs: completed,
        completionRate: totalOrgs > 0 ? completed / totalOrgs : 0,
        medianHoursFromPrevious: transitionSamples.length > 0 ? this.median(transitionSamples) : 0,
        dropOffFromPrevious:
          previousStep && previousCompleted > 0
            ? (previousCompleted - completed) / previousCompleted
            : 0
      };
    });

    const activatedOrgs = organizations.filter((organization) => {
      const stepMap = orgStepTimes.get(organization.id) ?? new Map<string, Date>();
      return requiredActivationSteps.every((step) => stepMap.has(step));
    }).length;

    return {
      windowDays: filters.days,
      totalOrgs,
      activationRequiredSteps: requiredActivationSteps,
      activationRate: totalOrgs > 0 ? activatedOrgs / totalOrgs : 0,
      steps: stepSummaries,
      quality: {
        missingStepAnomalies,
        outOfOrderEvents
      }
    };
  }

  async getDashboard(filters: { organizationId?: string; pilotCohortId?: string; days: number }) {
    await this.ensureDerivedStepEvents(filters);

    const requiredSteps = this.config.activationRequiredSteps;
    const from = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);

    const organizations = await this.prisma.organization.findMany({
      where: {
        ...(filters.organizationId ? { id: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      select: {
        id: true,
        pilotCohortId: true
      }
    });

    const stepEvents = await this.prisma.analyticsEvent.findMany({
      where: {
        occurredAt: { gte: from },
        eventName: { in: ['org_created', ...requiredSteps] },
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      orderBy: [{ organizationId: 'asc' }, { occurredAt: 'asc' }],
      select: {
        organizationId: true,
        eventName: true,
        occurredAt: true,
        pilotCohortId: true
      }
    });

    const byOrg = new Map<string, Map<string, Date>>();
    for (const event of stepEvents) {
      if (!byOrg.has(event.organizationId)) {
        byOrg.set(event.organizationId, new Map<string, Date>());
      }
      const map = byOrg.get(event.organizationId) as Map<string, Date>;
      if (!map.has(event.eventName)) {
        map.set(event.eventName, event.occurredAt);
      }
    }

    const daily = new Map<string, { created: number; activated: number }>();
    const weekly = new Map<string, { created: number; activated: number }>();
    const cohort = new Map<string, { total: number; activated: number }>();

    for (const organization of organizations) {
      const events = byOrg.get(organization.id) ?? new Map<string, Date>();
      const createdAt = events.get('org_created');
      if (!createdAt) {
        continue;
      }

      const activated = requiredSteps.every((step) => events.has(step));
      const dayKey = createdAt.toISOString().slice(0, 10);
      const weekKey = this.toWeekKey(createdAt);
      const cohortKey = organization.pilotCohortId ?? 'unassigned';

      daily.set(dayKey, {
        created: (daily.get(dayKey)?.created ?? 0) + 1,
        activated: (daily.get(dayKey)?.activated ?? 0) + (activated ? 1 : 0)
      });

      weekly.set(weekKey, {
        created: (weekly.get(weekKey)?.created ?? 0) + 1,
        activated: (weekly.get(weekKey)?.activated ?? 0) + (activated ? 1 : 0)
      });

      cohort.set(cohortKey, {
        total: (cohort.get(cohortKey)?.total ?? 0) + 1,
        activated: (cohort.get(cohortKey)?.activated ?? 0) + (activated ? 1 : 0)
      });
    }

    return {
      windowDays: filters.days,
      activationRequiredSteps: requiredSteps,
      dailyActivationRates: [...daily.entries()].map(([day, value]) => ({
        day,
        created: value.created,
        activated: value.activated,
        activationRate: value.created > 0 ? value.activated / value.created : 0
      })),
      weeklyActivationRates: [...weekly.entries()].map(([week, value]) => ({
        week,
        created: value.created,
        activated: value.activated,
        activationRate: value.created > 0 ? value.activated / value.created : 0
      })),
      cohortBreakdown: [...cohort.entries()].map(([pilotCohortId, value]) => ({
        pilotCohortId,
        totalOrgs: value.total,
        activatedOrgs: value.activated,
        activationRate: value.total > 0 ? value.activated / value.total : 0
      }))
    };
  }

  private async ensureDerivedStepEvents(filters: {
    organizationId?: string;
    pilotCohortId?: string;
    days?: number;
  }) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        ...(filters.organizationId ? { id: filters.organizationId } : {}),
        ...(filters.pilotCohortId ? { pilotCohortId: filters.pilotCohortId } : {})
      },
      select: {
        id: true,
        createdAt: true,
        pilotCohortId: true
      }
    });

    for (const organization of organizations) {
      await this.analytics.recordEvent({
        organizationId: organization.id,
        eventName: 'org_created',
        actorRole: 'system',
        source: 'api',
        entityType: 'Organization',
        entityId: organization.id,
        occurredAt: organization.createdAt,
        idempotencyKey: `onboarding:org_created:${organization.id}`
      });

      const invitedMembership = await this.prisma.membership.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'asc' },
        skip: 1,
        select: { id: true, createdAt: true }
      });

      if (invitedMembership) {
        await this.analytics.recordEvent({
          organizationId: organization.id,
          eventName: 'team_invited',
          actorRole: 'system',
          source: 'api',
          entityType: 'Membership',
          entityId: invitedMembership.id,
          occurredAt: invitedMembership.createdAt,
          idempotencyKey: `onboarding:team_invited:${organization.id}`
        });
      }

      for (const [eventName, stepName] of Object.entries(DERIVED_STEP_BY_EVENT)) {
        const firstEvent = await this.prisma.analyticsEvent.findFirst({
          where: {
            organizationId: organization.id,
            eventName
          },
          orderBy: { occurredAt: 'asc' },
          select: { id: true, occurredAt: true }
        });

        if (!firstEvent) {
          continue;
        }

        await this.analytics.recordEvent({
          organizationId: organization.id,
          eventName: stepName,
          actorRole: 'system',
          source: 'api',
          entityType: 'AnalyticsEvent',
          entityId: firstEvent.id,
          occurredAt: firstEvent.occurredAt,
          idempotencyKey: `onboarding:${stepName}:${organization.id}`
        });
      }
    }
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

  private toWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const delta = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }
}
