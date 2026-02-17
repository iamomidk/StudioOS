import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, AccessTokenGuard]
})
export class ProjectsModule {}
