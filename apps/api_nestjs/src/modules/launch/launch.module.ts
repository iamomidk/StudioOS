import { Module } from '@nestjs/common';

import { MetricsModule } from '../../common/modules/metrics/metrics.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LaunchController } from './launch.controller.js';
import { LaunchService } from './launch.service.js';

@Module({
  imports: [MetricsModule, ConfigModule, PrismaModule],
  controllers: [LaunchController],
  providers: [LaunchService, AccessTokenGuard, RolesGuard]
})
export class LaunchModule {}
