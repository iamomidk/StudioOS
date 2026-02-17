import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ApprovePurgeDto } from './dto/approve-purge.dto.js';
import { DeactivateProvisionedUserDto } from './dto/deactivate-provisioned-user.dto.js';
import { ExportComplianceDto } from './dto/export-compliance.dto.js';
import { ListEnterpriseSettingsDto } from './dto/list-enterprise-settings.dto.js';
import { RequestPurgeDto } from './dto/request-purge.dto.js';
import { UpdateEnterpriseSettingsDto } from './dto/update-enterprise-settings.dto.js';
import { UpsertProvisionedUserDto } from './dto/upsert-provisioned-user.dto.js';
import { EnterpriseService } from './enterprise.service.js';

@Controller('enterprise')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get('settings')
  getSettings(@Query() query: ListEnterpriseSettingsDto) {
    return this.enterprise.getSettings(query.organizationId);
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateEnterpriseSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.enterprise.updateSettings(dto, request.user);
  }

  @Post('provisioning/users')
  upsertProvisionedUser(
    @Body() dto: UpsertProvisionedUserDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterprise.upsertProvisionedUser(dto, request.user);
  }

  @Patch('provisioning/users/:userId/deactivate')
  deactivateProvisionedUser(
    @Param('userId') userId: string,
    @Body() dto: DeactivateProvisionedUserDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterprise.deactivateProvisionedUser(userId, dto, request.user);
  }

  @Post('users/:userId/purge-requests')
  requestPurge(
    @Param('userId') userId: string,
    @Body() dto: RequestPurgeDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterprise.requestPurge(userId, dto, request.user);
  }

  @Patch('purge-requests/:requestId/approve')
  approvePurge(
    @Param('requestId') requestId: string,
    @Body() dto: ApprovePurgeDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.enterprise.approvePurge(requestId, dto, request.user);
  }

  @Get('exports/audit')
  exportAudit(@Query() query: ExportComplianceDto, @Req() request: AuthenticatedRequest) {
    return this.enterprise.exportAuditLogs(query, request.user);
  }

  @Get('exports/admin-actions')
  exportAdminActions(@Query() query: ExportComplianceDto, @Req() request: AuthenticatedRequest) {
    return this.enterprise.exportAdminActionLogs(query, request.user);
  }

  @Get('exports/access')
  exportAccess(@Query() query: ExportComplianceDto, @Req() request: AuthenticatedRequest) {
    return this.enterprise.exportAccessLogs(query, request.user);
  }
}
