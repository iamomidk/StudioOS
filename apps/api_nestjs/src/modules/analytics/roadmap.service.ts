import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AnalyticsService } from './analytics.service.js';
import { GenerateRoadmapScorecardDto } from './dto/roadmap/generate-scorecard.dto.js';
import { ListRoadmapScorecardsDto } from './dto/roadmap/list-scorecards.dto.js';
import { UpsertStrategicMetricDefinitionDto } from './dto/roadmap/upsert-metric-definition.dto.js';
import { VersionStrategicMetricDefinitionDto } from './dto/roadmap/version-metric-definition.dto.js';

@Injectable()
export class RoadmapInstrumentationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService
  ) {}

  async upsertDefinition(dto: UpsertStrategicMetricDefinitionDto, actor?: AccessClaims) {
    const definition = await this.prisma.strategicMetricDefinition.upsert({
      where: {
        organizationId_metricKey: {
          organizationId: dto.organizationId,
          metricKey: dto.metricKey
        }
      },
      update: {
        title: dto.title,
        kind: dto.kind,
        owner: dto.owner,
        guardrail: dto.guardrail ?? null,
        status: 'active'
      },
      create: {
        organizationId: dto.organizationId,
        metricKey: dto.metricKey,
        title: dto.title,
        kind: dto.kind,
        owner: dto.owner,
        guardrail: dto.guardrail ?? null,
        status: 'active'
      }
    });

    const latestVersion = await this.prisma.strategicMetricDefinitionVersion.findFirst({
      where: { definitionId: definition.id },
      orderBy: { versionNumber: 'desc' }
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await this.prisma.strategicMetricDefinitionVersion.create({
      data: {
        definitionId: definition.id,
        versionNumber: nextVersionNumber,
        formula: dto.formula,
        targetValue: dto.targetValue,
        changeReason: latestVersion ? 'definition_upsert' : 'initial',
        approvedByUserId: actor?.sub ?? null
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'StrategicMetricDefinition',
      definition.id,
      'roadmap.metric_definition.upserted',
      {
        metricKey: dto.metricKey,
        versionNumber: version.versionNumber
      }
    );

    return {
      ...definition,
      activeVersion: version
    };
  }

  async versionDefinition(
    definitionId: string,
    dto: VersionStrategicMetricDefinitionDto,
    actor?: AccessClaims
  ) {
    const definition = await this.prisma.strategicMetricDefinition.findFirst({
      where: {
        id: definitionId,
        organizationId: dto.organizationId
      }
    });
    if (!definition) {
      throw new NotFoundException('Metric definition not found');
    }

    const latestVersion = await this.prisma.strategicMetricDefinitionVersion.findFirst({
      where: { definitionId: definition.id },
      orderBy: { versionNumber: 'desc' }
    });

    const version = await this.prisma.strategicMetricDefinitionVersion.create({
      data: {
        definitionId: definition.id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        formula: dto.formula,
        targetValue: dto.targetValue,
        changeReason: dto.changeReason ?? 'manual_update',
        approvedByUserId: actor?.sub ?? null
      }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'StrategicMetricDefinition',
      definition.id,
      'roadmap.metric_definition.versioned',
      {
        versionNumber: version.versionNumber,
        changeReason: version.changeReason
      }
    );

    return version;
  }

  async generateScorecard(dto: GenerateRoadmapScorecardDto, actor?: AccessClaims) {
    const windowDays = dto.windowDays ?? (dto.frequency === 'weekly' ? 7 : 30);
    const pilotKpis = await this.analytics.getPilotKpis({
      organizationId: dto.organizationId,
      days: windowDays
    });

    const definitions = await this.prisma.strategicMetricDefinition.findMany({
      where: {
        organizationId: dto.organizationId,
        status: 'active'
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        }
      }
    });

    const generatedAt = new Date();
    const periodStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const periodEnd = generatedAt;

    const scorecard = await this.prisma.strategicScorecard.create({
      data: {
        organizationId: dto.organizationId,
        frequency: dto.frequency,
        periodStart,
        periodEnd,
        generatedAt,
        northStarMetricKey: this.resolveNorthStarMetricKey(definitions),
        onTrack: true,
        confidence: this.estimateConfidence(pilotKpis.totals.bookingCreated),
        summary: {
          windowDays,
          conversionRate: pilotKpis.kpis.leadToBookingConversionRate,
          fillRate: pilotKpis.kpis.onTimeDeliveryRate,
          dsoDays: pilotKpis.kpis.dsoDays
        }
      }
    });

    const metrics = await Promise.all(
      definitions.map(async (definition) => {
        const version = definition.versions[0];
        if (!version) {
          throw new NotFoundException(`Definition version missing for ${definition.metricKey}`);
        }

        const value = this.computeMetricValue(definition.metricKey, pilotKpis);
        const variance = value - version.targetValue;
        const anomaly = Math.abs(variance) > Math.max(0.1, version.targetValue * 0.3);

        const metric = await this.prisma.strategicScorecardMetric.create({
          data: {
            scorecardId: scorecard.id,
            definitionId: definition.id,
            definitionVersionId: version.id,
            metricKey: definition.metricKey,
            value,
            targetValue: version.targetValue,
            variance,
            confidence: scorecard.confidence,
            anomaly,
            commentary: null
          }
        });

        return { metric, definition, version };
      })
    );

    if (dto.experimentId) {
      await Promise.all(
        metrics.map(({ metric }) =>
          this.prisma.strategicExperimentImpact.create({
            data: {
              scorecardMetricId: metric.id,
              experimentId: dto.experimentId!,
              preWindowValue: metric.value * 0.95,
              postWindowValue: metric.value,
              deltaValue: metric.value * 0.05,
              notes: 'Linked by generated scorecard helper'
            }
          })
        )
      );
    }

    const northStarMetric = metrics.find(({ definition }) => definition.kind === 'north_star');
    const onTrack = northStarMetric
      ? northStarMetric.metric.value >= northStarMetric.metric.targetValue
      : true;

    await this.prisma.strategicScorecard.update({
      where: { id: scorecard.id },
      data: { onTrack }
    });

    await this.audit(
      dto.organizationId,
      actor?.sub,
      'StrategicScorecard',
      scorecard.id,
      'roadmap.scorecard.generated',
      {
        frequency: dto.frequency,
        windowDays,
        metricCount: metrics.length,
        experimentId: dto.experimentId ?? null,
        onTrack
      }
    );

    return this.prisma.strategicScorecard.findUniqueOrThrow({
      where: { id: scorecard.id },
      include: {
        metrics: {
          include: {
            experimentImpacts: true,
            definition: true,
            definitionVersion: true
          },
          orderBy: { metricKey: 'asc' }
        }
      }
    });
  }

  async listScorecards(query: ListRoadmapScorecardsDto) {
    return this.prisma.strategicScorecard.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.frequency ? { frequency: query.frequency } : {})
      },
      include: {
        metrics: {
          include: {
            experimentImpacts: true,
            definition: true,
            definitionVersion: true
          },
          orderBy: { metricKey: 'asc' }
        }
      },
      orderBy: { generatedAt: 'desc' }
    });
  }

  private resolveNorthStarMetricKey(
    definitions: Array<{ kind: string; metricKey: string }>
  ): string {
    return (
      definitions.find((definition) => definition.kind === 'north_star')?.metricKey ??
      'conversion_rate'
    );
  }

  private estimateConfidence(bookingCount: number): number {
    if (bookingCount >= 100) {
      return 0.95;
    }
    if (bookingCount >= 30) {
      return 0.8;
    }
    return 0.6;
  }

  private computeMetricValue(
    metricKey: string,
    kpis: Awaited<ReturnType<AnalyticsService['getPilotKpis']>>
  ): number {
    switch (metricKey) {
      case 'conversion_rate':
        return kpis.kpis.leadToBookingConversionRate;
      case 'fill_rate':
        return kpis.kpis.onTimeDeliveryRate;
      case 'utilization_rate':
        return kpis.kpis.rentalUtilizationRate;
      case 'dso_days':
        return kpis.kpis.dsoDays;
      case 'incident_rate':
        return kpis.kpis.incidentRate;
      default:
        return 0;
    }
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
}
