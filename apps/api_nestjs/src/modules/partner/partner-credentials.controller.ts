import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { CreatePartnerCredentialDto } from './dto/create-partner-credential.dto.js';
import { ListPartnerCredentialsDto } from './dto/list-partner-credentials.dto.js';
import { RotatePartnerCredentialDto } from './dto/rotate-partner-credential.dto.js';
import { UpdatePartnerCredentialStatusDto } from './dto/update-partner-credential-status.dto.js';
import { PartnerService } from './partner.service.js';

@Controller('partner/credentials')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class PartnerCredentialsController {
  constructor(private readonly partner: PartnerService) {}

  @Post()
  create(@Body() dto: CreatePartnerCredentialDto, @Req() request: AuthenticatedRequest) {
    return this.partner.createCredential(dto, request.user);
  }

  @Get()
  list(@Query() query: ListPartnerCredentialsDto) {
    return this.partner.listCredentials(query.organizationId);
  }

  @Post(':credentialId/rotate')
  rotate(
    @Param('credentialId') credentialId: string,
    @Query() query: ListPartnerCredentialsDto,
    @Body() dto: RotatePartnerCredentialDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partner.rotateCredential(credentialId, query.organizationId, dto, request.user);
  }

  @Patch(':credentialId/status')
  updateStatus(
    @Param('credentialId') credentialId: string,
    @Query() query: ListPartnerCredentialsDto,
    @Body() dto: UpdatePartnerCredentialStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.partner.updateCredentialStatus(
      credentialId,
      query.organizationId,
      dto,
      request.user
    );
  }

  @Get('usage/dashboard')
  usageDashboard(@Query() query: ListPartnerCredentialsDto) {
    return this.partner.usageDashboard(query.organizationId);
  }
}
