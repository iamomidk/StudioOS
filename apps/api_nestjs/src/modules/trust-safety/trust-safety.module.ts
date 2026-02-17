import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrustSafetyController } from './trust-safety.controller.js';
import { TrustSafetyService } from './trust-safety.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TrustSafetyController],
  providers: [TrustSafetyService, AccessTokenGuard, RolesGuard]
})
export class TrustSafetyModule {}
