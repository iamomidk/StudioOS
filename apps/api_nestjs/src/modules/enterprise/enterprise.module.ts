import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnterpriseController } from './enterprise.controller.js';
import { EnterpriseService } from './enterprise.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, AccessTokenGuard, RolesGuard],
  exports: [EnterpriseService]
})
export class EnterpriseModule {}
