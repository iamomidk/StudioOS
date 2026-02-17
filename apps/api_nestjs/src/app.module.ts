import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { HealthModule } from './common/modules/health/health.module.js';
import { MetricsModule } from './common/modules/metrics/metrics.module.js';
import { RegionRoutingGuard } from './common/security/region-routing.guard.js';
import { RateLimitGuard } from './common/security/rate-limit.guard.js';
import { SecurityHeadersInterceptor } from './common/security/security-headers.interceptor.js';
import { ConfigModule } from './config/config.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { DisputesModule } from './modules/disputes/disputes.module.js';
import { EnterpriseModule } from './modules/enterprise/enterprise.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { LaunchModule } from './modules/launch/launch.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrgsModule } from './modules/orgs/orgs.module.js';
import { PartnerModule } from './modules/partner/partner.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { QueuesModule } from './modules/queues/queues.module.js';
import { RentalsModule } from './modules/rentals/rentals.module.js';
import { RiskModule } from './modules/risk/risk.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    MetricsModule,
    QueuesModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CrmModule,
    BookingsModule,
    ProjectsModule,
    InventoryModule,
    RentalsModule,
    RiskModule,
    SupportModule,
    StorageModule,
    BillingModule,
    NotificationsModule,
    PartnerModule,
    AuditModule,
    AnalyticsModule,
    LaunchModule,
    MarketplaceModule,
    DisputesModule,
    EnterpriseModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RegionRoutingGuard
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityHeadersInterceptor
    }
  ]
})
export class AppModule {}
