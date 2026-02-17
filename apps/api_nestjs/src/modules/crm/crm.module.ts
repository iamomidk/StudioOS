import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CrmController } from './crm.controller.js';
import { CrmService } from './crm.service.js';
import { QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AnalyticsModule],
  controllers: [CrmController, QuotesController],
  providers: [CrmService, QuotesService, AccessTokenGuard]
})
export class CrmModule {}
