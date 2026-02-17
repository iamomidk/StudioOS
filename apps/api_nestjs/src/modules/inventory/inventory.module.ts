import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, AccessTokenGuard]
})
export class InventoryModule {}
