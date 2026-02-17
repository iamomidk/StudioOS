import { Module } from '@nestjs/common';

import { MetricsModule } from '../../common/modules/metrics/metrics.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentWebhookService } from './payment-webhook.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule, MetricsModule, AnalyticsModule],
  controllers: [BillingController, PaymentWebhookController],
  providers: [BillingService, PaymentWebhookService, AccessTokenGuard]
})
export class BillingModule {}
