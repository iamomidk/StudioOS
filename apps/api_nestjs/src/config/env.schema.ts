import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(1),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(1),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('studioos-local-bucket'),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  S3_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).default(10485760),
  S3_ALLOWED_CONTENT_TYPES: z
    .string()
    .min(1)
    .default('image/jpeg,image/png,image/webp,video/mp4,application/pdf'),
  PAYMENT_WEBHOOK_DEMO_SECRET: z.string().min(1).default('demo-webhook-secret'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),
  SENTRY_DSN: z.string().default(''),
  OTEL_ENABLED: booleanFromEnv.default(false),
  FEATURE_MARKETPLACE_ENABLED: booleanFromEnv.default(false),
  FEATURE_DISPUTES_ENABLED: booleanFromEnv.default(false)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(rawEnv: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(rawEnv);
}
