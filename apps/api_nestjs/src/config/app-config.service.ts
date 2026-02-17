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

  get jwtAccessTokenSecret(): string {
    return this.env.JWT_ACCESS_TOKEN_SECRET;
  }

  get jwtRefreshTokenSecret(): string {
    return this.env.JWT_REFRESH_TOKEN_SECRET;
  }

  get awsRegion(): string {
    return this.env.AWS_REGION;
  }

  get s3Bucket(): string {
    return this.env.S3_BUCKET;
  }

  get s3PresignTtlSeconds(): number {
    return this.env.S3_PRESIGN_TTL_SECONDS;
  }

  get s3MaxUploadBytes(): number {
    return this.env.S3_MAX_UPLOAD_BYTES;
  }

  get s3AllowedContentTypes(): string[] {
    return this.env.S3_ALLOWED_CONTENT_TYPES.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get paymentWebhookDemoSecret(): string {
    return this.env.PAYMENT_WEBHOOK_DEMO_SECRET;
  }

  get corsAllowedOrigins(): string[] {
    return this.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get rateLimitTtlSeconds(): number {
    return this.env.RATE_LIMIT_TTL_SECONDS;
  }

  get rateLimitMaxRequests(): number {
    return this.env.RATE_LIMIT_MAX_REQUESTS;
  }

  get sentryDsn(): string {
    return this.env.SENTRY_DSN;
  }

  get otelEnabled(): boolean {
    return this.env.OTEL_ENABLED;
  }

  get smokeOpsEnabled(): boolean {
    return this.env.SMOKE_OPS_ENABLED;
  }

  get smokeCheckToken(): string {
    return this.env.SMOKE_CHECK_TOKEN;
  }

  get featureMarketplaceEnabled(): boolean {
    return this.env.FEATURE_MARKETPLACE_ENABLED;
  }

  get featureDisputesEnabled(): boolean {
    return this.env.FEATURE_DISPUTES_ENABLED;
  }
}
