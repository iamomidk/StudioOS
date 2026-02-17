import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AnalyticsModule],
  controllers: [BookingsController],
  providers: [BookingsService, AccessTokenGuard]
})
export class BookingsModule {}
