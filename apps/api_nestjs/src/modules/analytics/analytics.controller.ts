import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { AnalyticsService } from './analytics.service.js';
import { ListPilotKpisDto } from './dto/list-pilot-kpis.dto.js';

@Controller('analytics/pilot-kpis')
@UseGuards(AccessTokenGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  list(@Query() query: ListPilotKpisDto) {
    return this.analytics.getPilotKpis({
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.pilotCohortId ? { pilotCohortId: query.pilotCohortId } : {}),
      days: query.days ?? 7
    });
  }

  @Get('quality')
  quality(@Query() query: ListPilotKpisDto) {
    return this.analytics.getDataQuality({
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.pilotCohortId ? { pilotCohortId: query.pilotCohortId } : {}),
      days: query.days ?? 7
    });
  }
}
