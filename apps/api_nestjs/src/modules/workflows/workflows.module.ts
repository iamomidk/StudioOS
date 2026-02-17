import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { QueuesModule } from '../queues/queues.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SupportModule } from '../support/support.module.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule, SupportModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, AccessTokenGuard, RolesGuard],
  exports: [WorkflowsService]
})
export class WorkflowsModule {}
