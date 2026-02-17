import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ListRiskDashboardDto } from './dto/list-risk-dashboard.dto.js';
import { ListRiskEvaluationsDto } from './dto/list-risk-evaluations.dto.js';
import { ResolveFalsePositiveDto } from './dto/resolve-false-positive.dto.js';
import { RiskService } from './risk.service.js';

@Controller('risk')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('explain')
  explain(@Query() query: ListRiskEvaluationsDto) {
    return this.risk.getExplain(query.organizationId, query.limit);
  }

  @Get('dashboard')
  dashboard(@Query() query: ListRiskDashboardDto) {
    return this.risk.getDashboard(query.organizationId, query.pilotCohortId);
  }

  @Patch('false-positives/:evaluationId/resolve')
  resolveFalsePositive(
    @Param('evaluationId') evaluationId: string,
    @Body() dto: ResolveFalsePositiveDto
  ) {
    return this.risk.resolveFalsePositive(evaluationId, dto.note);
  }
}
