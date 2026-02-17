import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { AdvanceContractDto } from './dto/advance-contract.dto.js';
import { ApproveContractStepDto } from './dto/approve-contract-step.dto.js';
import { ContractSearchDto } from './dto/contract-search.dto.js';
import { CreateAmendmentDto } from './dto/create-amendment.dto.js';
import { CreateClauseSetDto } from './dto/create-clause-set.dto.js';
import { CreateContractDto } from './dto/create-contract.dto.js';
import { CreateRenewalScheduleDto } from './dto/create-renewal-schedule.dto.js';
import { SignatureWebhookDto } from './dto/signature-webhook.dto.js';
import { ContractsService } from './contracts.service.js';

@Controller('contracts')
@UseGuards(AccessTokenGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post('clause-sets')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createClauseSet(@Body() dto: CreateClauseSetDto, @Req() request: AuthenticatedRequest) {
    return this.contracts.createClauseSet(dto, request.user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createContract(@Body() dto: CreateContractDto, @Req() request: AuthenticatedRequest) {
    return this.contracts.createContract(dto, request.user);
  }

  @Post(':contractId/advance')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  advanceContract(
    @Param('contractId') contractId: string,
    @Body() dto: AdvanceContractDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.contracts.advanceContract(contractId, dto, request.user);
  }

  @Post(':contractId/approve-step')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  approveStep(
    @Param('contractId') contractId: string,
    @Body() dto: ApproveContractStepDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.contracts.approveStep(contractId, dto, request.user);
  }

  @Post(':contractId/amendments')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  createAmendment(
    @Param('contractId') contractId: string,
    @Body() dto: CreateAmendmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.contracts.createAmendment(contractId, dto, request.user);
  }

  @Post(':contractId/renewal-schedule')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  setRenewalSchedule(
    @Param('contractId') contractId: string,
    @Body() dto: CreateRenewalScheduleDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.contracts.setRenewalSchedule(contractId, dto, request.user);
  }

  @Post(':contractId/signature-webhook')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  signatureWebhook(@Param('contractId') contractId: string, @Body() dto: SignatureWebhookDto) {
    return this.contracts.handleSignatureWebhook(contractId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  searchContracts(@Query() query: ContractSearchDto) {
    return this.contracts.searchContracts(query);
  }
}
