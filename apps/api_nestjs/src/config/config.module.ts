import { Module } from '@nestjs/common';

import { APP_ENV, AppConfigService } from './app-config.service.js';
import { loadEnv } from './env.schema.js';

@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: () => loadEnv(process.env)
    },
    AppConfigService
  ],
  exports: [APP_ENV, AppConfigService]
})
export class ConfigModule {}
