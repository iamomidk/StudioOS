import { Inject, Injectable } from '@nestjs/common';

import type { AppEnv } from './env.schema.js';

export const APP_ENV = Symbol('APP_ENV');

@Injectable()
export class AppConfigService {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): AppEnv['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }
}
