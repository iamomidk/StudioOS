import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { CreateDisputeDto } from './dto/create-dispute.dto.js';
import { ListDisputesDto } from './dto/list-disputes.dto.js';
import { OverrideDisputePolicyDto } from './dto/override-dispute-policy.dto.js';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto.js';
import { DisputesService } from './disputes.service.js';

@Controller('disputes')
@UseGuards(AccessTokenGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  list(@Query() query: ListDisputesDto) {
    return this.disputesService.list(query.organizationId);
  }

  @Get('metrics')
  metrics(@Query() query: ListDisputesDto) {
    return this.disputesService.getMetrics(query.organizationId);
  }

  @Post()
  create(@Body() dto: CreateDisputeDto, @Req() request: AuthenticatedRequest) {
    return this.disputesService.create(dto, request.user);
  }

  @Patch(':disputeId/status')
  updateStatus(
    @Param('disputeId') disputeId: string,
    @Query() query: ListDisputesDto,
    @Body() dto: UpdateDisputeStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.disputesService.updateStatus(
      disputeId,
      query.organizationId,
      dto.status,
      request.user
    );
  }

  @Patch(':disputeId/override')
  overridePolicy(
    @Param('disputeId') disputeId: string,
    @Query() query: ListDisputesDto,
    @Body() dto: OverrideDisputePolicyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.disputesService.overridePolicy(disputeId, query.organizationId, dto, request.user);
  }
}
