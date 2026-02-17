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
  RECONCILIATION_DAILY_TOKEN: z.string().default(''),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(120),
  SENTRY_DSN: z.string().default(''),
  OTEL_ENABLED: booleanFromEnv.default(false),
  SMOKE_OPS_ENABLED: booleanFromEnv.default(false),
  SMOKE_CHECK_TOKEN: z.string().default(''),
  FEATURE_MARKETPLACE_ENABLED: booleanFromEnv.default(false),
  FEATURE_DISPUTES_ENABLED: booleanFromEnv.default(false),
  FEATURE_PUBLIC_LAUNCH_ENABLED: booleanFromEnv.default(false),
  PUBLIC_MODULES_GLOBAL_KILL_SWITCH: booleanFromEnv.default(false),
  PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS: z.string().default(''),
  PUBLIC_ROLLOUT_ALLOWLIST_COHORT_IDS: z.string().default(''),
  PUBLIC_ROLLOUT_PERCENTAGE: z.coerce.number().int().min(0).max(100).default(0),
  PUBLIC_ROLLOUT_HASH_SALT: z.string().min(1).default('studioos-public-rollout-v1'),
  FEATURE_PRICING_EXPERIMENTS_ENABLED: booleanFromEnv.default(false),
  PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH: booleanFromEnv.default(false),
  ONBOARDING_STEPS: z
    .string()
    .default(
      'org_created,team_invited,first_lead_created,first_quote_sent,first_booking_created,first_rental_reserved,first_invoice_issued'
    ),
  ACTIVATION_REQUIRED_STEPS: z.string().default('first_booking_created,first_invoice_issued'),
  FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED: booleanFromEnv.default(false),
  SUPPORT_ALERT_WEBHOOK_URL: z.string().default(''),
  SUPPORT_ALLOWED_ATTACHMENT_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,text/plain,application/pdf'),
  SUPPORT_MAX_ATTACHMENT_BYTES: z.coerce.number().int().min(1).default(5242880),
  SUPPORT_MAX_SUBMISSIONS_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  SLA_POLICY_VERSION: z.string().default('v1'),
  SLA_P0_FIRST_RESPONSE_MINUTES: z.coerce.number().int().min(1).default(15),
  SLA_P1_FIRST_RESPONSE_MINUTES: z.coerce.number().int().min(1).default(60),
  SLA_P2_FIRST_RESPONSE_MINUTES: z.coerce.number().int().min(1).default(240),
  SLA_P3_FIRST_RESPONSE_MINUTES: z.coerce.number().int().min(1).default(720),
  SLA_P0_RESOLUTION_MINUTES: z.coerce.number().int().min(1).default(240),
  SLA_P1_RESOLUTION_MINUTES: z.coerce.number().int().min(1).default(1440),
  SLA_P2_RESOLUTION_MINUTES: z.coerce.number().int().min(1).default(4320),
  SLA_P3_RESOLUTION_MINUTES: z.coerce.number().int().min(1).default(10080),
  SLA_BUSINESS_HOURS_ONLY: booleanFromEnv.default(false),
  SLA_BUSINESS_HOUR_START: z.coerce.number().int().min(0).max(23).default(9),
  SLA_BUSINESS_HOUR_END: z.coerce.number().int().min(1).max(24).default(17),
  SLA_ALERT_WEBHOOK_URL: z.string().default(''),
  SLA_QUOTE_RESPONSE_MINUTES: z.coerce.number().int().min(1).default(1440),
  SLA_BOOKING_CONFIRMATION_MINUTES: z.coerce.number().int().min(1).default(720)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(rawEnv: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(rawEnv);
}
