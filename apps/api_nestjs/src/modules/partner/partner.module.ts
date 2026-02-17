import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CrmModule } from '../crm/crm.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RentalsModule } from '../rentals/rentals.module.js';
import { PartnerApiController } from './partner-api.controller.js';
import { PartnerApiService } from './partner-api.service.js';
import { PartnerCredentialsController } from './partner-credentials.controller.js';
import { PartnerUsageInterceptor } from './partner-usage.interceptor.js';
import { PartnerApiKeyGuard } from './auth/partner-api-key.guard.js';
import { PartnerService } from './partner.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, CrmModule, BookingsModule, RentalsModule],
  controllers: [PartnerApiController, PartnerCredentialsController],
  providers: [
    PartnerService,
    PartnerApiService,
    PartnerApiKeyGuard,
    PartnerUsageInterceptor,
    AccessTokenGuard,
    RolesGuard
  ],
  exports: [PartnerService]
})
export class PartnerModule {}
