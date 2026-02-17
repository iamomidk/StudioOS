import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueuesModule } from '../queues/queues.module.js';
import { SlaController } from './sla.controller.js';
import { SupportSlaService } from './sla.service.js';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule],
  controllers: [SupportController, SlaController],
  providers: [SupportService, SupportSlaService, AccessTokenGuard, RolesGuard],
  exports: [SupportService, SupportSlaService]
})
export class SupportModule {}
