import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { GenerateRoadmapScorecardDto } from './dto/roadmap/generate-scorecard.dto.js';
import { ListRoadmapScorecardsDto } from './dto/roadmap/list-scorecards.dto.js';
import { UpsertStrategicMetricDefinitionDto } from './dto/roadmap/upsert-metric-definition.dto.js';
import { VersionStrategicMetricDefinitionDto } from './dto/roadmap/version-metric-definition.dto.js';
import { RoadmapInstrumentationService } from './roadmap.service.js';

@Controller('analytics/roadmap')
@UseGuards(AccessTokenGuard)
export class RoadmapInstrumentationController {
  constructor(private readonly roadmap: RoadmapInstrumentationService) {}

  @Post('definitions')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  upsertDefinition(
    @Body() dto: UpsertStrategicMetricDefinitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.roadmap.upsertDefinition(dto, request.user);
  }

  @Patch('definitions/:definitionId/version')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  versionDefinition(
    @Param('definitionId') definitionId: string,
    @Body() dto: VersionStrategicMetricDefinitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.roadmap.versionDefinition(definitionId, dto, request.user);
  }

  @Post('scorecards/generate')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  generateScorecard(
    @Body() dto: GenerateRoadmapScorecardDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.roadmap.generateScorecard(dto, request.user);
  }

  @Get('scorecards')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listScorecards(@Query() query: ListRoadmapScorecardsDto) {
    return this.roadmap.listScorecards(query);
  }
}
