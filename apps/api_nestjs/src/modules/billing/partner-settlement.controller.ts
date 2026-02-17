import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ComputePartnerSettlementPeriodDto } from './dto/partner-settlement/compute-period.dto.js';
import { CreatePartnerSettlementAdjustmentDto } from './dto/partner-settlement/create-adjustment.dto.js';
import { CreatePartnerSettlementAgreementDto } from './dto/partner-settlement/create-agreement.dto.js';
import { CreatePartnerSettlementPeriodDto } from './dto/partner-settlement/create-period.dto.js';
import { ListPartnerSettlementPeriodsDto } from './dto/partner-settlement/list-periods.dto.js';
import { UpdatePartnerSettlementPeriodStatusDto } from './dto/partner-settlement/update-period-status.dto.js';
import { PartnerSettlementService } from './partner-settlement.service.js';

@Controller('billing/partner-settlement')
@UseGuards(AccessTokenGuard)
export class PartnerSettlementController {
  constructor(private readonly partnerSettlement: PartnerSettlementService) {}

  @Post('agreements')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createAgreement(
    @Body() dto: CreatePartnerSettlementAgreementDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partnerSettlement.createAgreement(dto, request.user);
  }

  @Post('agreements/:agreementId/periods')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createPeriod(
    @Param('agreementId') agreementId: string,
    @Body() dto: CreatePartnerSettlementPeriodDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partnerSettlement.createPeriod(agreementId, dto, request.user);
  }

  @Post('periods/:periodId/compute')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  computePeriod(
    @Param('periodId') periodId: string,
    @Body() dto: ComputePartnerSettlementPeriodDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partnerSettlement.computePeriod(periodId, dto, request.user);
  }

  @Post('periods/:periodId/adjustments')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createAdjustment(
    @Param('periodId') periodId: string,
    @Body() dto: CreatePartnerSettlementAdjustmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partnerSettlement.createAdjustment(periodId, dto, request.user);
  }

  @Patch('periods/:periodId/status')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  updateStatus(
    @Param('periodId') periodId: string,
    @Body() dto: UpdatePartnerSettlementPeriodStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partnerSettlement.updatePeriodStatus(periodId, dto, request.user);
  }

  @Get('periods')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listPeriods(@Query() query: ListPartnerSettlementPeriodsDto) {
    return this.partnerSettlement.listPeriods(query);
  }

  @Get('periods/:periodId/report')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  report(@Param('periodId') periodId: string, @Query('organizationId') organizationId: string) {
    return this.partnerSettlement.report(periodId, organizationId);
  }
}
