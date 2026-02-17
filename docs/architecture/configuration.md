# Configuration Matrix

This document lists baseline environment variables for each app and service in StudioOS.

## apps/api_nestjs

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test`, `production`. |
| `PORT` | No | `3000` | API listen port. |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/studioos` | PostgreSQL connection string. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string. |
| `JWT_ACCESS_TOKEN_SECRET` | Yes | `change-me-access-secret` | Access token signing secret. |
| `JWT_REFRESH_TOKEN_SECRET` | Yes | `change-me-refresh-secret` | Refresh token signing secret. |
| `AWS_REGION` | No | `us-east-1` | AWS region used for S3 signing. |
| `S3_BUCKET` | No | `studioos-media` | Bucket for signed uploads/downloads. |
| `S3_PRESIGN_TTL_SECONDS` | No | `900` | Signed URL expiry in seconds (60-3600). |
| `S3_MAX_UPLOAD_BYTES` | No | `10485760` | Maximum allowed direct-upload payload size. |
| `S3_ALLOWED_CONTENT_TYPES` | No | `image/jpeg,image/png,image/webp,video/mp4,application/pdf` | Comma-separated upload MIME allowlist. |
| `PAYMENT_WEBHOOK_DEMO_SECRET` | No | `change-me-payment-webhook-secret` | HMAC secret for demo payment webhook signature validation. |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3001` | Comma-separated browser origin allowlist for API CORS policy. |
| `RATE_LIMIT_TTL_SECONDS` | No | `60` | Request-rate window length in seconds. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `120` | Maximum requests per client IP within a rate-limit window. |
| `SENTRY_DSN` | No | `` | API Sentry DSN for runtime error reporting. |
| `OTEL_ENABLED` | No | `false` | Enables API OpenTelemetry runtime hooks/logging. |
| `SMOKE_OPS_ENABLED` | No | `false` | Enables token-gated smoke-only API endpoints (`/health/workers`, `/health/queue-smoke`, `/health/smoke-cleanup`). |
| `SMOKE_CHECK_TOKEN` | No | `change-me-smoke-token` | Shared token expected in `x-smoke-token` header for smoke-only API endpoints. |
| `ALERT_WEBHOOK_URL` | No | `` | Alert destination webhook endpoint for SLO alert routing/integration checks. |
| `ALERT_ROUTING_KEY` | No | `` | Optional alert routing key/token header value for webhook-based routing. |
| `FEATURE_MARKETPLACE_ENABLED` | No | `false` | Enables marketplace search API feature skeleton. |
| `FEATURE_DISPUTES_ENABLED` | No | `false` | Enables disputes module API feature skeleton. |

## apps/web_nextjs

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:3000` | Base URL for API requests from web app. |
| `API_BASE_URL` | No | `http://localhost:3000` | Server-side API base URL override for Next.js route handlers. |
| `NEXT_PUBLIC_APP_NAME` | No | `StudioOS` | Display/application name. |
| `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID` | No | `` | Default org ID prefilled in CRM lead conversion UI. |
| `NEXT_PUBLIC_SENTRY_DSN` | No | `` | Browser Sentry DSN for web client-side errors. |

## apps/mobile_flutter

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `API_BASE_URL` | Yes | `http://localhost:3000` | API endpoint for mobile app integration. |
| `API_DEFAULT_ORGANIZATION_ID` | No | `` | Default organization ID prefilled in field operations screen. |
| `SENTRY_DSN` | No | `` | Sentry DSN when mobile observability is enabled. |

## services/media_worker_python

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `MEDIA_WORKER_PORT` | No | `8101` | Local service listen port. |
| `API_BASE_URL` | Yes | `http://localhost:3000` | Callback target for job status updates. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Queue broker location. |
| `MEDIA_JOBS_QUEUE` | No | `media-jobs` | Redis list key used for inbound media jobs. |
| `MEDIA_WORKER_CALLBACK_TOKEN` | No | `` | Optional worker token sent to callback endpoint (`X-Worker-Token`). |
| `S3_BUCKET` | Yes | `studioos-media` | Media bucket name. |
| `AWS_REGION` | Yes | `us-east-1` | AWS region for object operations. |
| `FFMPEG_BINARY_PATH` | No | `ffmpeg` | Binary path used by future proxy generation implementation. |

## services/pricing_worker_python

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `PRICING_WORKER_PORT` | No | `8102` | Local service listen port. |
| `API_BASE_URL` | Yes | `http://localhost:3000` | Callback/API integration base URL. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Queue broker location. |
| `PRICING_JOBS_QUEUE` | No | `pricing-jobs` | Redis list key used for inbound pricing jobs. |
| `PRICING_WORKER_CALLBACK_TOKEN` | No | `` | Optional worker token sent to callback endpoint (`X-Worker-Token`). |

## Fail-fast behavior

`apps/api_nestjs` performs schema validation at bootstrap. Missing required variables abort startup with a non-zero exit code.

## Smoke runner (release ops)

`pnpm smoke:test` expects these process env vars at runtime:

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `SMOKE_BASE_URL_API` | Yes | `https://staging-api.example.com` | Remote API base URL used by smoke checks. |
| `SMOKE_BASE_URL_WEB` | Yes | `https://staging.example.com` | Remote web base URL used by smoke checks. |
| `SMOKE_USER_EMAIL` | Yes | `smoke-user@example.com` | Dedicated smoke user login identifier. |
| `SMOKE_USER_PASSWORD` | Yes | `change-me-smoke-password` | Dedicated smoke user password (set via secret manager, never committed). |
| `SMOKE_ORG_ID` | Yes | `org_smoke_123` | Dedicated smoke organization/tenant id. |
| `SMOKE_CHECK_TOKEN` | Yes | `change-me-smoke-token` | Token passed as `x-smoke-token` to protected smoke endpoints. |
| `SMOKE_TIMEOUT_MS` | No | `300000` | Global smoke timeout budget (default 300000ms / 5 minutes). |

## Backup verify runner (release ops)

`pnpm backup:verify` expects these process env vars at runtime:

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `BACKUP_S3_BUCKET` | Yes | `studioos-backups-staging` | S3 bucket that stores backup artifacts. |
| `BACKUP_S3_PREFIX` | No | `postgres/` | Prefix used when discovering latest backup object. |
| `BACKUP_AWS_REGION` | Yes | `us-east-1` | Region used for S3 backup discovery/download. |
| `BACKUP_VERIFY_TIMEOUT_MS` | No | `600000` | Timeout budget for restore drill workflow. |
| `BACKUP_MIN_ORG_ROWS` | No | `0` | Minimum expected `Organization` row count after restore. |
