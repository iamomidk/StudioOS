import { Controller, Get, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { LaunchService } from './launch.service.js';

@Controller('launch')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class LaunchController {
  constructor(private readonly launch: LaunchService) {}

  @Get('health')
  getHealth() {
    return this.launch.getHealth();
  }
}
