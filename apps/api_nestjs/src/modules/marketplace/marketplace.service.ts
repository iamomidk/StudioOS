import { Injectable, NotFoundException } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service.js';
import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchMarketplaceDto } from './dto/search-marketplace.dto.js';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async search(query: SearchMarketplaceDto, actor?: AccessClaims) {
    if (!this.config.featureMarketplaceEnabled) {
      throw new NotFoundException('Marketplace search is disabled');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: query.organizationId },
      select: { pilotCohortId: true }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!this.config.isPublicRolloutEnabledFor(query.organizationId, organization.pilotCohortId)) {
      throw new NotFoundException('Marketplace search is not enabled for this organization');
    }

    const assets = await this.prisma.asset.findMany({
      where: {
        organizationId: query.organizationId,
        category: { contains: query.category, mode: 'insensitive' }
      },
      take: 25
    });

    const results = assets.map((asset, index) => ({
      assetId: asset.id,
      name: asset.name,
      category: asset.category,
      location: query.location ?? 'unknown',
      availabilityScore: Math.max(0.2, 1 - index * 0.03),
      rating: 4.5,
      distanceKm: query.location ? 12.5 : null,
      rankScore: Math.max(0.2, 1 - index * 0.03)
    }));

    await this.prisma.auditLog.create({
      data: {
        organizationId: query.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'MarketplaceSearch',
        entityId: query.category,
        action: 'marketplace.search.executed',
        metadata: {
          location: query.location ?? null,
          dateFrom: query.dateFrom ?? null,
          dateTo: query.dateTo ?? null,
          resultCount: results.length
        }
      }
    });

    return {
      filters: query,
      results
    };
  }
}
