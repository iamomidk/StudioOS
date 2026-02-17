import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ApproveBillingAdjustmentDto } from './dto/enterprise/approve-adjustment.dto.js';
import { CancelEnterpriseSubscriptionDto } from './dto/enterprise/cancel-subscription.dto.js';
import { ChangeEnterpriseSeatsDto } from './dto/enterprise/change-seats.dto.js';
import { CloseEnterpriseBillingPeriodDto } from './dto/enterprise/close-period.dto.js';
import { CreateBillingAdjustmentDto } from './dto/enterprise/create-adjustment.dto.js';
import { CreateEnterprisePlanDto } from './dto/enterprise/create-plan.dto.js';
import { CreateEnterpriseSubscriptionDto } from './dto/enterprise/create-subscription.dto.js';
import { EnterpriseBillingReportDto } from './dto/enterprise/enterprise-report.dto.js';
import { IngestEnterpriseUsageDto } from './dto/enterprise/ingest-usage.dto.js';
import { EnterpriseBillingService } from './enterprise-billing.service.js';

@Controller('billing/enterprise')
@UseGuards(AccessTokenGuard)
export class EnterpriseBillingController {
  constructor(private readonly enterpriseBilling: EnterpriseBillingService) {}

  @Post('plans')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createPlan(@Body() dto: CreateEnterprisePlanDto, @Req() request: AuthenticatedRequest) {
    return this.enterpriseBilling.createPlan(dto, request.user);
  }

  @Post('subscriptions')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createSubscription(
    @Body() dto: CreateEnterpriseSubscriptionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.createSubscription(dto, request.user);
  }

  @Patch('subscriptions/:subscriptionId/seats')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  changeSeats(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: ChangeEnterpriseSeatsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.changeSeats(subscriptionId, dto, request.user);
  }

  @Post('subscriptions/:subscriptionId/usage')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  ingestUsage(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: IngestEnterpriseUsageDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.ingestUsage(subscriptionId, dto, request.user);
  }

  @Post('subscriptions/:subscriptionId/close-period')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  closePeriod(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: CloseEnterpriseBillingPeriodDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.closePeriod(subscriptionId, dto, request.user);
  }

  @Patch('subscriptions/:subscriptionId/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  cancelSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: CancelEnterpriseSubscriptionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.cancelSubscription(subscriptionId, dto, request.user);
  }

  @Get('subscriptions/:subscriptionId/history')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listHistory(
    @Param('subscriptionId') subscriptionId: string,
    @Query('organizationId') organizationId: string
  ) {
    return this.enterpriseBilling.listSubscriptionHistory(subscriptionId, organizationId);
  }

  @Post('adjustments')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createAdjustment(@Body() dto: CreateBillingAdjustmentDto, @Req() request: AuthenticatedRequest) {
    return this.enterpriseBilling.createAdjustment(dto, request.user);
  }

  @Patch('adjustments/:adjustmentId')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner)
  approveAdjustment(
    @Param('adjustmentId') adjustmentId: string,
    @Body() dto: ApproveBillingAdjustmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterpriseBilling.approveAdjustment(adjustmentId, dto, request.user);
  }

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  report(@Query() query: EnterpriseBillingReportDto) {
    return this.enterpriseBilling.enterpriseReport(query);
  }
}
