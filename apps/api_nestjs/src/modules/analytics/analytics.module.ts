import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { PricingExperimentsController } from './pricing-experiments.controller.js';
import { PricingExperimentsService } from './pricing-experiments.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AnalyticsController, PricingExperimentsController],
  providers: [AnalyticsService, PricingExperimentsService, AccessTokenGuard, RolesGuard],
  exports: [AnalyticsService, PricingExperimentsService]
})
export class AnalyticsModule {}
