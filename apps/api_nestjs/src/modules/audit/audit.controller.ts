import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

@Controller('audit/logs')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.Owner, Role.Manager)
  listLogs(@Query() query: ListAuditLogsDto) {
    return this.auditService.listLogs(query);
  }
}
