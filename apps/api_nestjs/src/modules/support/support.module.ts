import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule],
  controllers: [SupportController],
  providers: [SupportService, AccessTokenGuard, RolesGuard],
  exports: [SupportService]
})
export class SupportModule {}
