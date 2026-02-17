import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RentalsController } from './rentals.controller.js';
import { RentalsService } from './rentals.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AnalyticsModule],
  controllers: [RentalsController],
  providers: [RentalsService, AccessTokenGuard]
})
export class RentalsModule {}
