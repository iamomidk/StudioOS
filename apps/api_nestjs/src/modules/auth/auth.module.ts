import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './rbac/access-token.guard.js';
import { RbacProbeController } from './rbac/rbac-probe.controller.js';
import { RolesGuard } from './rbac/roles.guard.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController, RbacProbeController],
  providers: [AuthService, AccessTokenGuard, RolesGuard]
})
export class AuthModule {}
