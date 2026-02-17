import { Module } from '@nestjs/common';

import { ConfigModule } from '../../../config/config.module.js';
import { PrismaModule } from '../../../modules/prisma/prisma.module.js';
import { QueuesModule } from '../../../modules/queues/queues.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, QueuesModule],
  controllers: [HealthController]
})
export class HealthModule {}
