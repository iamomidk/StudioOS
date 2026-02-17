import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AllocationTargetType,
  ExperimentStatus,
  type PricingAllocationRule,
  type PricingVariant
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePricingExperimentDto } from './dto/create-pricing-experiment.dto.js';
import { EvaluatePricingDto } from './dto/evaluate-pricing.dto.js';

const CONVERSION_EVENTS = new Set(['quote_accepted', 'booking_created', 'invoice_paid']);

@Injectable()
export class PricingExperimentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async createExperiment(dto: CreatePricingExperimentDto) {
    if (dto.endsAt && dto.startsAt && dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('Experiment end time must be after start time');
    }

    if (dto.allocationRules.some((rule) => rule.targetType !== 'all' && !rule.targetValue)) {
      throw new BadRequestException('Organization and cohort allocation rules require targetValue');
    }

    const totalWeight = dto.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight <= 0) {
      throw new BadRequestException('At least one variant with positive weight is required');
    }

    return this.prisma.pricingExperiment.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        startsAt: dto.startsAt ?? null,
        endsAt: dto.endsAt ?? null,
        killSwitchEnabled: dto.killSwitchEnabled ?? false,
        maxExposure: dto.maxExposure ?? null,
        status: 'draft',
        variants: {
          create: dto.variants.map((variant) => ({
            key: variant.key,
            name: variant.name,
            weight: variant.weight,
            pricingMultiplier: variant.pricingMultiplier ?? null
          }))
        },
        allocationRules: {
          create: dto.allocationRules.map((rule) => ({
            targetType: rule.targetType,
            targetValue: rule.targetValue ?? null
          }))
        }
      },
      include: {
        variants: true,
        allocationRules: true
      }
    });
  }

  async activateExperiment(experimentId: string) {
    return this.updateStatus(experimentId, 'active');
  }

  async pauseExperiment(experimentId: string) {
    return this.updateStatus(experimentId, 'paused');
  }

  async stopExperiment(experimentId: string) {
    return this.updateStatus(experimentId, 'stopped');
  }

  async evaluatePricing(input: EvaluatePricingDto) {
    const baseline = {
      experimentApplied: false,
      experimentKey: null,
      variantKey: null,
      adjustedAmountCents: input.baseAmountCents,
      baselineAmountCents: input.baseAmountCents
    };

    if (
      !this.config.featurePricingExperimentsEnabled ||
      this.config.pricingExperimentsGlobalKillSwitch
    ) {
      return baseline;
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, pilotOrg: true, pilotCohortId: true }
    });

    if (!organization || !organization.pilotOrg) {
      return baseline;
    }

    const experiment = await this.findApplicableExperiment({
      organizationId: organization.id,
      pilotCohortId: organization.pilotCohortId,
      ...(input.experimentKey ? { experimentKey: input.experimentKey } : {})
    });

    if (!experiment) {
      return baseline;
    }

    const subjectType = input.userId ? 'user' : 'organization';
    const subjectKey = input.userId ?? organization.id;
    const variant = this.selectVariant(experiment.variants, `${experiment.id}:${subjectKey}`);

    const idempotencyKey =
      input.idempotencyKey ??
      `${experiment.id}:${subjectType}:${subjectKey}:${input.entityType ?? 'pricing'}:${input.entityId ?? ''}`;

    const existingExposure = await this.prisma.pricingExposureLog.findUnique({
      where: { idempotencyKey },
      include: { variant: true, experiment: true }
    });

    const chosenVariant = existingExposure?.variant ?? variant;

    if (!existingExposure) {
      await this.prisma.pricingExposureLog.create({
        data: {
          experimentId: experiment.id,
          variantId: variant.id,
          organizationId: organization.id,
          subjectType,
          subjectKey,
          source: input.source ?? 'api',
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          idempotencyKey,
          occurredAt: new Date()
        }
      });
    }

    const adjustedAmountCents = this.applyPricingMultiplier(
      input.baseAmountCents,
      chosenVariant.pricingMultiplier
    );

    return {
      experimentApplied: true,
      experimentKey: experiment.key,
      variantKey: chosenVariant.key,
      adjustedAmountCents,
      baselineAmountCents: input.baseAmountCents
    };
  }

  async getExperimentMetrics(experimentId: string, days = 30) {
    const experiment = await this.prisma.pricingExperiment.findUnique({
      where: { id: experimentId },
      include: { variants: true }
    });

    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [exposures, conversions] = await Promise.all([
      this.prisma.pricingExposureLog.groupBy({
        by: ['variantId'],
        where: { experimentId: experiment.id, occurredAt: { gte: from } },
        _count: { _all: true }
      }),
      this.prisma.pricingConversionEventLink.groupBy({
        by: ['exposureLogId', 'eventName'],
        where: {
          exposureLog: { experimentId: experiment.id },
          occurredAt: { gte: from }
        },
        _count: { _all: true }
      })
    ]);

    const exposureCounts = new Map<string, number>();
    for (const exposure of exposures) {
      exposureCounts.set(exposure.variantId, exposure._count._all);
    }

    const links = await this.prisma.pricingConversionEventLink.findMany({
      where: {
        exposureLog: { experimentId: experiment.id },
        occurredAt: { gte: from }
      },
      include: {
        exposureLog: {
          select: { variantId: true }
        }
      }
    });

    const conversionByVariant = new Map<
      string,
      { quoteAccepted: number; bookingCreated: number; invoicePaid: number }
    >();
    for (const variant of experiment.variants) {
      conversionByVariant.set(variant.id, {
        quoteAccepted: 0,
        bookingCreated: 0,
        invoicePaid: 0
      });
    }

    for (const link of links) {
      const bucket = conversionByVariant.get(link.exposureLog.variantId);
      if (!bucket) {
        continue;
      }

      if (link.eventName === 'quote_accepted') {
        bucket.quoteAccepted += 1;
      }
      if (link.eventName === 'booking_created') {
        bucket.bookingCreated += 1;
      }
      if (link.eventName === 'invoice_paid') {
        bucket.invoicePaid += 1;
      }
    }

    return {
      experimentId: experiment.id,
      experimentKey: experiment.key,
      status: experiment.status,
      windowDays: days,
      variants: experiment.variants.map((variant) => {
        const exposuresCount = exposureCounts.get(variant.id) ?? 0;
        const conversion = conversionByVariant.get(variant.id) ?? {
          quoteAccepted: 0,
          bookingCreated: 0,
          invoicePaid: 0
        };
        return {
          variantId: variant.id,
          variantKey: variant.key,
          exposures: exposuresCount,
          quoteAccepted: conversion.quoteAccepted,
          bookingCreated: conversion.bookingCreated,
          invoicePaid: conversion.invoicePaid,
          quoteAcceptanceRate: exposuresCount > 0 ? conversion.quoteAccepted / exposuresCount : 0,
          bookingCreationRate: exposuresCount > 0 ? conversion.bookingCreated / exposuresCount : 0,
          invoicePaidRate: exposuresCount > 0 ? conversion.invoicePaid / exposuresCount : 0
        };
      }),
      conversionsSampleSize: conversions.length
    };
  }

  async getDashboard(days = 30) {
    const experiments = await this.prisma.pricingExperiment.findMany({
      where: {
        status: { in: ['active', 'paused'] }
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    const summaries = [];
    for (const experiment of experiments) {
      summaries.push(await this.getExperimentMetrics(experiment.id, days));
    }

    return {
      windowDays: days,
      experiments: summaries
    };
  }

  async linkConversionForAnalyticsEvent(event: {
    id: string;
    organizationId: string;
    eventName: string;
    occurredAt: Date;
    entityType?: string | null;
    entityId?: string | null;
    payload?: Record<string, unknown> | null;
  }) {
    if (!CONVERSION_EVENTS.has(event.eventName)) {
      return;
    }

    const payloadQuoteId =
      event.payload && typeof event.payload.quoteId === 'string' ? event.payload.quoteId : null;
    const matchingRules: Array<{
      entityType?: string;
      entityId?: string;
      subjectType?: string;
      subjectKey?: string;
    }> = [];
    if (event.entityId) {
      matchingRules.push({
        ...(event.entityType ? { entityType: event.entityType } : {}),
        entityId: event.entityId
      });
    }
    if (payloadQuoteId) {
      matchingRules.push({ entityType: 'Quote', entityId: payloadQuoteId });
    }
    matchingRules.push({ subjectType: 'organization', subjectKey: event.organizationId });

    const exposures = await this.prisma.pricingExposureLog.findMany({
      where: {
        organizationId: event.organizationId,
        occurredAt: { lte: event.occurredAt },
        OR: matchingRules
      },
      orderBy: { occurredAt: 'desc' },
      take: 3
    });

    for (const exposure of exposures) {
      await this.prisma.pricingConversionEventLink.upsert({
        where: {
          exposureLogId_analyticsEventId: {
            exposureLogId: exposure.id,
            analyticsEventId: event.id
          }
        },
        update: {},
        create: {
          exposureLogId: exposure.id,
          analyticsEventId: event.id,
          eventName: event.eventName,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          occurredAt: event.occurredAt
        }
      });
    }
  }

  private async updateStatus(experimentId: string, status: ExperimentStatus) {
    const experiment = await this.prisma.pricingExperiment.findUnique({
      where: { id: experimentId }
    });
    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    return this.prisma.pricingExperiment.update({
      where: { id: experimentId },
      data: { status }
    });
  }

  private async findApplicableExperiment(input: {
    organizationId: string;
    pilotCohortId: string | null;
    experimentKey?: string;
  }) {
    const now = new Date();

    const candidates = await this.prisma.pricingExperiment.findMany({
      where: {
        status: 'active',
        killSwitchEnabled: false,
        ...(input.experimentKey ? { key: input.experimentKey } : {}),
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }]
      },
      include: {
        variants: { where: { weight: { gt: 0 } }, orderBy: { createdAt: 'asc' } },
        allocationRules: true,
        _count: { select: { exposureLogs: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    for (const experiment of candidates) {
      if (experiment.maxExposure && experiment._count.exposureLogs >= experiment.maxExposure) {
        continue;
      }

      if (
        this.isTargetMatch(experiment.allocationRules, input.organizationId, input.pilotCohortId)
      ) {
        return experiment;
      }
    }

    return null;
  }

  private isTargetMatch(
    rules: PricingAllocationRule[],
    organizationId: string,
    pilotCohortId: string | null
  ): boolean {
    return rules.some((rule) => {
      if (rule.targetType === AllocationTargetType.all) {
        return true;
      }
      if (rule.targetType === AllocationTargetType.organization) {
        return rule.targetValue === organizationId;
      }
      if (rule.targetType === AllocationTargetType.cohort) {
        return pilotCohortId !== null && rule.targetValue === pilotCohortId;
      }
      return false;
    });
  }

  private selectVariant(variants: PricingVariant[], stableKey: string): PricingVariant {
    if (variants.length === 0) {
      throw new BadRequestException('Experiment has no active variants');
    }

    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
    const hash = createHash('sha256').update(stableKey).digest('hex').slice(0, 12);
    const bucket = Number.parseInt(hash, 16) % totalWeight;

    let cursor = 0;
    for (const variant of variants) {
      cursor += variant.weight;
      if (bucket < cursor) {
        return variant;
      }
    }

    return variants[variants.length - 1] as PricingVariant;
  }

  private applyPricingMultiplier(baseAmountCents: number, multiplier?: number | null): number {
    if (!multiplier || multiplier <= 0 || multiplier === 1) {
      return baseAmountCents;
    }
    return Math.max(0, Math.round(baseAmountCents * multiplier));
  }
}
