import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RiskController } from './risk.controller.js';
import { RiskService } from './risk.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [RiskController],
  providers: [RiskService, AccessTokenGuard, RolesGuard],
  exports: [RiskService]
})
export class RiskModule {}
