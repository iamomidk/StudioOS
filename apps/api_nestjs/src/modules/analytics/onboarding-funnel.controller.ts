import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { ListOnboardingFunnelDto } from './dto/list-onboarding-funnel.dto.js';
import { OnboardingFunnelService } from './onboarding-funnel.service.js';

@Controller('analytics/onboarding-funnel')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Owner, Role.Manager)
export class OnboardingFunnelController {
  constructor(private readonly onboardingFunnel: OnboardingFunnelService) {}

  @Get()
  list(@Query() query: ListOnboardingFunnelDto) {
    return this.onboardingFunnel.getFunnel({
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.pilotCohortId ? { pilotCohortId: query.pilotCohortId } : {}),
      days: query.days ?? 30
    });
  }

  @Get('dashboard')
  dashboard(@Query() query: ListOnboardingFunnelDto) {
    return this.onboardingFunnel.getDashboard({
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.pilotCohortId ? { pilotCohortId: query.pilotCohortId } : {}),
      days: query.days ?? 30
    });
  }
}
