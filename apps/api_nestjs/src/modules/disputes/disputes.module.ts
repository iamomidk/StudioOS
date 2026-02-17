import { Module } from '@nestjs/common';

import { ConfigModule } from '../../config/config.module.js';
import { DisputesController } from './disputes.controller.js';
import { DisputesService } from './disputes.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [DisputesController],
  providers: [DisputesService]
})
export class DisputesModule {}
