import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { OnboardingFunnelController } from './onboarding-funnel.controller.js';
import { OnboardingFunnelService } from './onboarding-funnel.service.js';
import { PricingExperimentsController } from './pricing-experiments.controller.js';
import { PricingExperimentsService } from './pricing-experiments.service.js';
import { RoadmapInstrumentationController } from './roadmap.controller.js';
import { RoadmapInstrumentationService } from './roadmap.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [
    AnalyticsController,
    PricingExperimentsController,
    OnboardingFunnelController,
    RoadmapInstrumentationController
  ],
  providers: [
    AnalyticsService,
    PricingExperimentsService,
    OnboardingFunnelService,
    RoadmapInstrumentationService,
    AccessTokenGuard,
    RolesGuard
  ],
  exports: [
    AnalyticsService,
    PricingExperimentsService,
    OnboardingFunnelService,
    RoadmapInstrumentationService
  ]
})
export class AnalyticsModule {}
