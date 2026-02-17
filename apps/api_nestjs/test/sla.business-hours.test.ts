import assert from 'node:assert/strict';
import test from 'node:test';

import { AppConfigService } from '../src/config/app-config.service.js';
import { SupportSlaService } from '../src/modules/support/sla.service.js';

function buildConfig(overrides: Record<string, unknown>): AppConfigService {
  const baseEnv = {
    PORT: 3000,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'a',
    JWT_REFRESH_TOKEN_SECRET: 'b',
    AWS_REGION: 'us-east-1',
    S3_BUCKET: 'bucket',
    S3_PRESIGN_TTL_SECONDS: 900,
    S3_MAX_UPLOAD_BYTES: 1024,
    S3_ALLOWED_CONTENT_TYPES: 'image/png',
    PAYMENT_WEBHOOK_DEMO_SECRET: 'x',
    CORS_ALLOWED_ORIGINS: '',
    RATE_LIMIT_TTL_SECONDS: 60,
    RATE_LIMIT_MAX_REQUESTS: 120,
    SENTRY_DSN: '',
    OTEL_ENABLED: false,
    SMOKE_OPS_ENABLED: false,
    SMOKE_CHECK_TOKEN: '',
    FEATURE_MARKETPLACE_ENABLED: false,
    FEATURE_DISPUTES_ENABLED: false,
    FEATURE_PRICING_EXPERIMENTS_ENABLED: false,
    PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH: false,
    ONBOARDING_STEPS: '',
    ACTIVATION_REQUIRED_STEPS: '',
    FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED: false,
    SUPPORT_ALERT_WEBHOOK_URL: '',
    SUPPORT_ALLOWED_ATTACHMENT_TYPES: 'image/png',
    SUPPORT_MAX_ATTACHMENT_BYTES: 1024,
    SUPPORT_MAX_SUBMISSIONS_PER_MINUTE: 5,
    SLA_POLICY_VERSION: 'v1',
    SLA_P0_FIRST_RESPONSE_MINUTES: 15,
    SLA_P1_FIRST_RESPONSE_MINUTES: 60,
    SLA_P2_FIRST_RESPONSE_MINUTES: 240,
    SLA_P3_FIRST_RESPONSE_MINUTES: 720,
    SLA_P0_RESOLUTION_MINUTES: 240,
    SLA_P1_RESOLUTION_MINUTES: 1440,
    SLA_P2_RESOLUTION_MINUTES: 4320,
    SLA_P3_RESOLUTION_MINUTES: 10080,
    SLA_BUSINESS_HOURS_ONLY: false,
    SLA_BUSINESS_HOUR_START: 9,
    SLA_BUSINESS_HOUR_END: 17,
    SLA_ALERT_WEBHOOK_URL: '',
    SLA_QUOTE_RESPONSE_MINUTES: 1440,
    SLA_BOOKING_CONFIRMATION_MINUTES: 720,
    ...overrides
  };

  return new AppConfigService(baseEnv as never);
}

void test('SLA due time is linear in 24/7 mode', () => {
  const config = buildConfig({ SLA_BUSINESS_HOURS_ONLY: false });
  const service = new SupportSlaService({} as never, config);

  const start = new Date('2026-02-20T17:30:00.000Z');
  const due = (
    service as unknown as { addBusinessAwareMinutes: (a: Date, b: number) => Date }
  ).addBusinessAwareMinutes(start, 120);

  assert.equal(due.toISOString(), '2026-02-20T19:30:00.000Z');
});

void test('SLA due time skips off-hours in business-hours mode', () => {
  const config = buildConfig({
    SLA_BUSINESS_HOURS_ONLY: true,
    SLA_BUSINESS_HOUR_START: 9,
    SLA_BUSINESS_HOUR_END: 17
  });
  const service = new SupportSlaService({} as never, config);

  const start = new Date(2026, 1, 20, 16, 30, 0); // Friday local time
  const due = (
    service as unknown as { addBusinessAwareMinutes: (a: Date, b: number) => Date }
  ).addBusinessAwareMinutes(start, 120);

  assert.equal(due.getDay(), 1); // Monday
  assert.equal(due.getHours(), 10);
  assert.equal(due.getMinutes(), 30);
});
