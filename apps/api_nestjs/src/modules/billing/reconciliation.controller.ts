import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { AssignReconciliationDiscrepancyDto } from './dto/reconciliation/assign-reconciliation-discrepancy.dto.js';
import { ListReconciliationDiscrepanciesDto } from './dto/reconciliation/list-reconciliation-discrepancies.dto.js';
import { ListReconciliationRunsDto } from './dto/reconciliation/list-reconciliation-runs.dto.js';
import { NoteReconciliationDiscrepancyDto } from './dto/reconciliation/note-reconciliation-discrepancy.dto.js';
import { ResolveReconciliationDiscrepancyDto } from './dto/reconciliation/resolve-reconciliation-discrepancy.dto.js';
import { RunDailyReconciliationDto } from './dto/reconciliation/run-daily-reconciliation.dto.js';
import { TriggerReconciliationDto } from './dto/reconciliation/trigger-reconciliation.dto.js';
import { ReconciliationService } from './reconciliation.service.js';

@Controller('billing/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('runs/trigger')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  async triggerRun(@Body() dto: TriggerReconciliationDto, @Req() request: AuthenticatedRequest) {
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : new Date();
    const periodStart = dto.periodStart
      ? new Date(dto.periodStart)
      : new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    return this.reconciliation.triggerRun(dto.organizationId, periodStart, periodEnd, request.user);
  }

  @Post('runs/daily')
  runDaily(
    @Body() dto: RunDailyReconciliationDto,
    @Headers('x-reconciliation-token') token?: string
  ) {
    return this.reconciliation.runDaily(dto.organizationId, token);
  }

  @Get('runs')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listRuns(@Query() query: ListReconciliationRunsDto) {
    return this.reconciliation.listRuns(query.organizationId, query.limit);
  }

  @Get('runs/:runId/report')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  exportRunReport(@Param('runId') runId: string, @Query() query: ListReconciliationRunsDto) {
    return this.reconciliation.getRun(runId, query.organizationId);
  }

  @Get('discrepancies')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listDiscrepancies(@Query() query: ListReconciliationDiscrepanciesDto) {
    return this.reconciliation.listDiscrepancies(query);
  }

  @Patch('discrepancies/:discrepancyId/acknowledge')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  acknowledge(
    @Param('discrepancyId') discrepancyId: string,
    @Query() query: ListReconciliationDiscrepanciesDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reconciliation.acknowledgeDiscrepancy(
      discrepancyId,
      query.organizationId,
      request.user
    );
  }

  @Patch('discrepancies/:discrepancyId/assign')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  assign(
    @Param('discrepancyId') discrepancyId: string,
    @Query() query: ListReconciliationDiscrepanciesDto,
    @Body() dto: AssignReconciliationDiscrepancyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reconciliation.assignDiscrepancy(
      discrepancyId,
      query.organizationId,
      dto.ownerUserId ?? null,
      dto.note,
      request.user
    );
  }

  @Post('discrepancies/:discrepancyId/notes')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  addNote(
    @Param('discrepancyId') discrepancyId: string,
    @Query() query: ListReconciliationDiscrepanciesDto,
    @Body() dto: NoteReconciliationDiscrepancyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reconciliation.addDiscrepancyNote(
      discrepancyId,
      query.organizationId,
      dto.note,
      request.user
    );
  }

  @Patch('discrepancies/:discrepancyId/resolve')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  resolve(
    @Param('discrepancyId') discrepancyId: string,
    @Query() query: ListReconciliationDiscrepanciesDto,
    @Body() dto: ResolveReconciliationDiscrepancyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reconciliation.resolveDiscrepancy(
      discrepancyId,
      query.organizationId,
      dto.resolutionReason,
      dto.note,
      request.user
    );
  }
}
