import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ModerationCaseDecisionDto } from './dto/case-decision.dto.js';
import { CreateModerationAppealDto } from './dto/create-appeal.dto.js';
import { CreateModerationPolicyDto } from './dto/create-policy.dto.js';
import { ListModerationCasesDto } from './dto/list-cases.dto.js';
import { ModerateContentDto } from './dto/moderate-content.dto.js';
import { ReportAbuseDto } from './dto/report-abuse.dto.js';
import { TrustSafetyService } from './trust-safety.service.js';

@Controller('trust-safety')
@UseGuards(AccessTokenGuard)
export class TrustSafetyController {
  constructor(private readonly trustSafety: TrustSafetyService) {}

  @Post('policies')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createPolicy(@Body() dto: CreateModerationPolicyDto, @Req() request: AuthenticatedRequest) {
    return this.trustSafety.createPolicy(dto, request.user);
  }

  @Post('moderate')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  moderate(@Body() dto: ModerateContentDto, @Req() request: AuthenticatedRequest) {
    return this.trustSafety.moderate(dto, request.user);
  }

  @Get('cases')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listCases(@Query() query: ListModerationCasesDto) {
    return this.trustSafety.listCases(query);
  }

  @Post('cases/:caseId/decisions')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  decideCase(
    @Param('caseId') caseId: string,
    @Body() dto: ModerationCaseDecisionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.trustSafety.decideCase(caseId, dto, request.user);
  }

  @Post('cases/:caseId/appeals')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createAppeal(
    @Param('caseId') caseId: string,
    @Body() dto: CreateModerationAppealDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.trustSafety.createAppeal(caseId, dto, request.user);
  }

  @Post('reports')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  reportAbuse(@Body() dto: ReportAbuseDto, @Req() request: AuthenticatedRequest) {
    return this.trustSafety.reportAbuse(dto, request.user);
  }

  @Get('metrics')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  metrics(@Query('organizationId') organizationId: string) {
    return this.trustSafety.metrics(organizationId);
  }
}
