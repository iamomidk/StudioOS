import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from './roles.decorator.js';
import { Role } from './role.enum.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { RolesGuard } from './roles.guard.js';

@Controller('rbac-probe')
@UseGuards(AccessTokenGuard, RolesGuard)
export class RbacProbeController {
  @Get('org-manage')
  @Roles(Role.Owner, Role.Manager)
  canManageOrg(): { ok: true } {
    return { ok: true };
  }

  @Get('shoot')
  @Roles(Role.Owner, Role.Manager, Role.Shooter)
  canShoot(): { ok: true } {
    return { ok: true };
  }

  @Get('edit')
  @Roles(Role.Owner, Role.Manager, Role.Editor)
  canEdit(): { ok: true } {
    return { ok: true };
  }

  @Get('rental-manage')
  @Roles(Role.Owner, Role.Manager, Role.Renter)
  canManageRental(): { ok: true } {
    return { ok: true };
  }

  @Get('client-portal')
  @Roles(Role.Client)
  canAccessClientPortal(): { ok: true } {
    return { ok: true };
  }
}
