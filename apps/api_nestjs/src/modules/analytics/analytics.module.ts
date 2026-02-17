import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AccessTokenGuard],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}
