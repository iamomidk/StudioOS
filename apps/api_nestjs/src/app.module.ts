import { Module } from '@nestjs/common';

import { HealthModule } from './common/modules/health/health.module.js';
import { APP_ENV, AppConfigService } from './config/app-config.service.js';
import { loadEnv } from './config/env.schema.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrgsModule } from './modules/orgs/orgs.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { RentalsModule } from './modules/rentals/rentals.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CrmModule,
    BookingsModule,
    ProjectsModule,
    InventoryModule,
    RentalsModule,
    BillingModule,
    NotificationsModule,
    AuditModule
  ],
  providers: [
    {
      provide: APP_ENV,
      useFactory: () => loadEnv(process.env)
    },
    AppConfigService
  ],
  exports: [AppConfigService]
})
export class AppModule {}
