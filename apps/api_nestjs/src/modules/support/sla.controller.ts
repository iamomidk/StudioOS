import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ListSupportTicketsDto } from './dto/list-support-tickets.dto.js';
import { SupportSlaService } from './sla.service.js';

@Controller('sla')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class SlaController {
  constructor(private readonly sla: SupportSlaService) {}

  @Get('dashboard')
  dashboard(@Query() query: ListSupportTicketsDto) {
    return this.sla.getDashboard(query.organizationId, 30);
  }

  @Get('weekly-report')
  weeklyReport(@Query() query: ListSupportTicketsDto) {
    return this.sla.getWeeklyReport(query.organizationId, 7);
  }
}
