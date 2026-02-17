import { Module } from '@nestjs/common';

import { MetricsModule } from '../../common/modules/metrics/metrics.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { EnterpriseBillingController } from './enterprise-billing.controller.js';
import { EnterpriseBillingService } from './enterprise-billing.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { ReconciliationController } from './reconciliation.controller.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule, MetricsModule, AnalyticsModule, RiskModule],
  controllers: [
    BillingController,
    EnterpriseBillingController,
    PaymentWebhookController,
    ReconciliationController
  ],
  providers: [
    BillingService,
    EnterpriseBillingService,
    PaymentWebhookService,
    ReconciliationService,
    AccessTokenGuard,
    RolesGuard
  ]
})
export class BillingModule {}
