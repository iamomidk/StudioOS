# Configuration Matrix

This document lists baseline environment variables for each app and service in StudioOS.

## apps/api_nestjs

| Variable                                 | Required | Example                                                                                                                         | Notes                                                                                                             |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                               | No       | `development`                                                                                                                   | `development`, `test`, `production`.                                                                              |
| `PORT`                                   | No       | `3000`                                                                                                                          | API listen port.                                                                                                  |
| `DATABASE_URL`                           | Yes      | `postgresql://postgres:postgres@localhost:5432/studioos`                                                                        | PostgreSQL connection string.                                                                                     |
| `REDIS_URL`                              | Yes      | `redis://localhost:6379`                                                                                                        | Redis connection string.                                                                                          |
| `JWT_ACCESS_TOKEN_SECRET`                | Yes      | `change-me-access-secret`                                                                                                       | Access token signing secret.                                                                                      |
| `JWT_REFRESH_TOKEN_SECRET`               | Yes      | `change-me-refresh-secret`                                                                                                      | Refresh token signing secret.                                                                                     |
| `AWS_REGION`                             | No       | `us-east-1`                                                                                                                     | AWS region used for S3 signing.                                                                                   |
| `S3_BUCKET`                              | No       | `studioos-media`                                                                                                                | Bucket for signed uploads/downloads.                                                                              |
| `S3_PRESIGN_TTL_SECONDS`                 | No       | `900`                                                                                                                           | Signed URL expiry in seconds (60-3600).                                                                           |
| `S3_MAX_UPLOAD_BYTES`                    | No       | `10485760`                                                                                                                      | Maximum allowed direct-upload payload size.                                                                       |
| `S3_ALLOWED_CONTENT_TYPES`               | No       | `image/jpeg,image/png,image/webp,video/mp4,application/pdf`                                                                     | Comma-separated upload MIME allowlist.                                                                            |
| `PAYMENT_WEBHOOK_DEMO_SECRET`            | No       | `change-me-payment-webhook-secret`                                                                                              | HMAC secret for demo payment webhook signature validation.                                                        |
| `RECONCILIATION_DAILY_TOKEN`             | No       | `change-me-reconciliation-token`                                                                                                | Shared token expected in `x-reconciliation-token` header for daily reconciliation trigger endpoint.               |
| `CORS_ALLOWED_ORIGINS`                   | No       | `http://localhost:3001`                                                                                                         | Comma-separated browser origin allowlist for API CORS policy.                                                     |
| `RATE_LIMIT_TTL_SECONDS`                 | No       | `60`                                                                                                                            | Request-rate window length in seconds.                                                                            |
| `RATE_LIMIT_MAX_REQUESTS`                | No       | `120`                                                                                                                           | Maximum requests per client IP within a rate-limit window.                                                        |
| `SENTRY_DSN`                             | No       | ``                                                                                                                              | API Sentry DSN for runtime error reporting.                                                                       |
| `OTEL_ENABLED`                           | No       | `false`                                                                                                                         | Enables API OpenTelemetry runtime hooks/logging.                                                                  |
| `SMOKE_OPS_ENABLED`                      | No       | `false`                                                                                                                         | Enables token-gated smoke-only API endpoints (`/health/workers`, `/health/queue-smoke`, `/health/smoke-cleanup`). |
| `SMOKE_CHECK_TOKEN`                      | No       | `change-me-smoke-token`                                                                                                         | Shared token expected in `x-smoke-token` header for smoke-only API endpoints.                                     |
| `ALERT_WEBHOOK_URL`                      | No       | ``                                                                                                                              | Alert destination webhook endpoint for SLO alert routing/integration checks.                                      |
| `ALERT_ROUTING_KEY`                      | No       | ``                                                                                                                              | Optional alert routing key/token header value for webhook-based routing.                                          |
| `FEATURE_MARKETPLACE_ENABLED`            | No       | `false`                                                                                                                         | Enables marketplace search API feature skeleton.                                                                  |
| `FEATURE_DISPUTES_ENABLED`               | No       | `false`                                                                                                                         | Enables disputes module API feature skeleton.                                                                     |
| `DISPUTE_POLICY_VERSION`                 | No       | `v1`                                                                                                                            | Policy version tag applied to new dispute automation decisions.                                                   |
| `RISK_SCORING_MODE`                      | No       | `ADVISORY`                                                                                                                      | Global risk rollout mode (`OFF`, `ADVISORY`, `SOFT_ENFORCE`, `HARD_ENFORCE`).                                     |
| `RISK_SCORING_GLOBAL_KILL_SWITCH`        | No       | `false`                                                                                                                         | Emergency control to disable risk enforcement/blocking immediately.                                               |
| `RISK_SCORING_BYPASS_ORG_IDS`            | No       | ``                                                                                                                              | Comma-separated org allowlist bypassing scoring enforcement.                                                      |
| `RISK_SCORING_ENFORCE_COHORT_IDS`        | No       | ``                                                                                                                              | Cohorts allowed to receive soft/hard enforcement; others fall back to advisory.                                   |
| `FEATURE_PUBLIC_LAUNCH_ENABLED`          | No       | `false`                                                                                                                         | Master switch for controlled public module rollout.                                                               |
| `PUBLIC_MODULES_GLOBAL_KILL_SWITCH`      | No       | `false`                                                                                                                         | Emergency global kill switch for public modules behind rollout controls.                                          |
| `PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS`       | No       | ``                                                                                                                              | Comma-separated org IDs enabled regardless of percentage rollout.                                                 |
| `PUBLIC_ROLLOUT_ALLOWLIST_COHORT_IDS`    | No       | ``                                                                                                                              | Comma-separated pilot cohort IDs enabled regardless of percentage rollout.                                        |
| `PUBLIC_ROLLOUT_PERCENTAGE`              | No       | `0`                                                                                                                             | Percentage-based rollout for non-allowlisted orgs (0-100).                                                        |
| `PUBLIC_ROLLOUT_HASH_SALT`               | No       | `studioos-public-rollout-v1`                                                                                                    | Salt used for deterministic rollout bucketing.                                                                    |
| `FEATURE_PRICING_EXPERIMENTS_ENABLED`    | No       | `false`                                                                                                                         | Enables server-side pricing experiment evaluation for pilot organizations.                                        |
| `PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH` | No       | `false`                                                                                                                         | Global emergency kill switch that disables all pricing experiments immediately.                                   |
| `ONBOARDING_STEPS`                       | No       | `org_created,team_invited,first_lead_created,first_quote_sent,first_booking_created,first_rental_reserved,first_invoice_issued` | Ordered onboarding funnel steps used for RC-07 activation analytics.                                              |
| `ACTIVATION_REQUIRED_STEPS`              | No       | `first_booking_created,first_invoice_issued`                                                                                    | Comma-separated step list that defines activation achievement without code changes.                               |
| `FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED`  | No       | `false`                                                                                                                         | Enables support safe admin actions (`resend-notification`, `retry-webhook`, `requeue-job`).                       |
| `SUPPORT_ALERT_WEBHOOK_URL`              | No       | ``                                                                                                                              | Optional webhook target for P0/P1 support ticket notifications.                                                   |
| `SUPPORT_ALLOWED_ATTACHMENT_TYPES`       | No       | `image/jpeg,image/png,image/webp,text/plain,application/pdf`                                                                    | Attachment MIME allowlist enforced on support submissions.                                                        |
| `SUPPORT_MAX_ATTACHMENT_BYTES`           | No       | `5242880`                                                                                                                       | Maximum allowed size for one support attachment in bytes.                                                         |
| `SUPPORT_MAX_SUBMISSIONS_PER_MINUTE`     | No       | `5`                                                                                                                             | Per-user/org support ticket submission rate limit over one minute.                                                |
| `SLA_POLICY_VERSION`                     | No       | `v1`                                                                                                                            | SLA policy version stamped into ticket SLA snapshots for historical correctness.                                  |
| `SLA_P0_FIRST_RESPONSE_MINUTES`          | No       | `15`                                                                                                                            | P0 first response target (minutes).                                                                               |
| `SLA_P1_FIRST_RESPONSE_MINUTES`          | No       | `60`                                                                                                                            | P1 first response target (minutes).                                                                               |
| `SLA_P2_FIRST_RESPONSE_MINUTES`          | No       | `240`                                                                                                                           | P2 first response target (minutes).                                                                               |
| `SLA_P3_FIRST_RESPONSE_MINUTES`          | No       | `720`                                                                                                                           | P3 first response target (minutes).                                                                               |
| `SLA_P0_RESOLUTION_MINUTES`              | No       | `240`                                                                                                                           | P0 resolution target (minutes).                                                                                   |
| `SLA_P1_RESOLUTION_MINUTES`              | No       | `1440`                                                                                                                          | P1 resolution target (minutes).                                                                                   |
| `SLA_P2_RESOLUTION_MINUTES`              | No       | `4320`                                                                                                                          | P2 resolution target (minutes).                                                                                   |
| `SLA_P3_RESOLUTION_MINUTES`              | No       | `10080`                                                                                                                         | P3 resolution target (minutes).                                                                                   |
| `SLA_BUSINESS_HOURS_ONLY`                | No       | `false`                                                                                                                         | Enables business-hours-only SLA clock advancement.                                                                |
| `SLA_BUSINESS_HOUR_START`                | No       | `9`                                                                                                                             | Local business hour start (0-23).                                                                                 |
| `SLA_BUSINESS_HOUR_END`                  | No       | `17`                                                                                                                            | Local business hour end (1-24).                                                                                   |
| `SLA_ALERT_WEBHOOK_URL`                  | No       | ``                                                                                                                              | Optional webhook for pre-breach/breach/recovery alerts.                                                           |
| `SLA_QUOTE_RESPONSE_MINUTES`             | No       | `1440`                                                                                                                          | Optional workflow SLA target for lead->quote response reporting.                                                  |
| `SLA_BOOKING_CONFIRMATION_MINUTES`       | No       | `720`                                                                                                                           | Optional workflow SLA target for quote->booking confirmation reporting.                                           |
| `ENTERPRISE_DEPROVISION_GRACE_SECONDS`   | No       | `900`                                                                                                                           | Grace window before deprovisioned users are blocked by auth guards.                                               |
| `BREAK_GLASS_ADMIN_EMAIL`                | No       | ``                                                                                                                              | Optional break-glass admin account email tracked for enterprise policy docs/runbooks.                             |
| `REGION_ID`                              | No       | `us-east-1`                                                                                                                     | Serving region identifier emitted in response headers and health metadata.                                        |
| `PRIMARY_REGION`                         | No       | `us-east-1`                                                                                                                     | Region treated as primary writer/home region when `FAILOVER_MODE=passive`.                                        |
| `FAILOVER_MODE`                          | No       | `off`                                                                                                                           | Multi-region traffic mode: `off`, `passive`, or `active`.                                                         |
| `REGION_DATA_POLICY`                     | No       | `global`                                                                                                                        | Data boundary policy: `global` shared data plane or `regional-boundary` locality-aware behavior.                  |
| `TRAFFIC_SHIFT_PERCENTAGE`               | No       | `100`                                                                                                                           | Percentage of requests accepted by non-primary regions during passive failover.                                   |
| `TRAFFIC_SHIFT_HASH_SALT`                | No       | `studioos-traffic-shift-v1`                                                                                                     | Hash salt used for deterministic traffic shift bucketing.                                                         |
| `MAINTENANCE_MODE_REGIONS`               | No       | ``                                                                                                                              | Comma-separated region IDs currently in maintenance mode; guarded requests return `503` unless bypassed.          |
| `MAINTENANCE_BYPASS_TOKEN`               | No       | ``                                                                                                                              | Optional header token (`x-region-maintenance-bypass`) to allow controlled maintenance drills.                     |
| `PERF_SLOW_QUERY_MS`                     | No       | `200`                                                                                                                           | Slow query threshold (ms) used by in-process Prisma profiling hooks exported via `/metrics`.                      |
| `BILLING_USAGE_ANOMALY_THRESHOLD`        | No       | `100000`                                                                                                                        | Usage quantity threshold that triggers anomaly audit + notification in enterprise billing ingestion.              |

## apps/web_nextjs

| Variable                              | Required | Example                 | Notes                                                         |
| ------------------------------------- | -------- | ----------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`            | Yes      | `http://localhost:3000` | Base URL for API requests from web app.                       |
| `API_BASE_URL`                        | No       | `http://localhost:3000` | Server-side API base URL override for Next.js route handlers. |
| `NEXT_PUBLIC_APP_NAME`                | No       | `StudioOS`              | Display/application name.                                     |
| `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID` | No       | ``                      | Default org ID prefilled in CRM lead conversion UI.           |
| `NEXT_PUBLIC_SENTRY_DSN`              | No       | ``                      | Browser Sentry DSN for web client-side errors.                |

## apps/mobile_flutter

| Variable                      | Required | Example                 | Notes                                                         |
| ----------------------------- | -------- | ----------------------- | ------------------------------------------------------------- |
| `API_BASE_URL`                | Yes      | `http://localhost:3000` | API endpoint for mobile app integration.                      |
| `API_DEFAULT_ORGANIZATION_ID` | No       | ``                      | Default organization ID prefilled in field operations screen. |
| `SENTRY_DSN`                  | No       | ``                      | Sentry DSN when mobile observability is enabled.              |

## services/media_worker_python

| Variable                      | Required | Example                  | Notes                                                               |
| ----------------------------- | -------- | ------------------------ | ------------------------------------------------------------------- |
| `MEDIA_WORKER_PORT`           | No       | `8101`                   | Local service listen port.                                          |
| `API_BASE_URL`                | Yes      | `http://localhost:3000`  | Callback target for job status updates.                             |
| `REDIS_URL`                   | Yes      | `redis://localhost:6379` | Queue broker location.                                              |
| `MEDIA_JOBS_QUEUE`            | No       | `media-jobs`             | Redis list key used for inbound media jobs.                         |
| `MEDIA_WORKER_CALLBACK_TOKEN` | No       | ``                       | Optional worker token sent to callback endpoint (`X-Worker-Token`). |
| `S3_BUCKET`                   | Yes      | `studioos-media`         | Media bucket name.                                                  |
| `AWS_REGION`                  | Yes      | `us-east-1`              | AWS region for object operations.                                   |
| `FFMPEG_BINARY_PATH`          | No       | `ffmpeg`                 | Binary path used by future proxy generation implementation.         |

## services/pricing_worker_python

| Variable                        | Required | Example                  | Notes                                                               |
| ------------------------------- | -------- | ------------------------ | ------------------------------------------------------------------- |
| `PRICING_WORKER_PORT`           | No       | `8102`                   | Local service listen port.                                          |
| `API_BASE_URL`                  | Yes      | `http://localhost:3000`  | Callback/API integration base URL.                                  |
| `REDIS_URL`                     | Yes      | `redis://localhost:6379` | Queue broker location.                                              |
| `PRICING_JOBS_QUEUE`            | No       | `pricing-jobs`           | Redis list key used for inbound pricing jobs.                       |
| `PRICING_WORKER_CALLBACK_TOKEN` | No       | ``                       | Optional worker token sent to callback endpoint (`X-Worker-Token`). |

## Fail-fast behavior

`apps/api_nestjs` performs schema validation at bootstrap. Missing required variables abort startup with a non-zero exit code.

## Smoke runner (release ops)

`pnpm smoke:test` expects these process env vars at runtime:

| Variable              | Required | Example                           | Notes                                                                    |
| --------------------- | -------- | --------------------------------- | ------------------------------------------------------------------------ |
| `SMOKE_BASE_URL_API`  | Yes      | `https://staging-api.example.com` | Remote API base URL used by smoke checks.                                |
| `SMOKE_BASE_URL_WEB`  | Yes      | `https://staging.example.com`     | Remote web base URL used by smoke checks.                                |
| `SMOKE_USER_EMAIL`    | Yes      | `smoke-user@example.com`          | Dedicated smoke user login identifier.                                   |
| `SMOKE_USER_PASSWORD` | Yes      | `change-me-smoke-password`        | Dedicated smoke user password (set via secret manager, never committed). |
| `SMOKE_ORG_ID`        | Yes      | `org_smoke_123`                   | Dedicated smoke organization/tenant id.                                  |
| `SMOKE_CHECK_TOKEN`   | Yes      | `change-me-smoke-token`           | Token passed as `x-smoke-token` to protected smoke endpoints.            |
| `SMOKE_TIMEOUT_MS`    | No       | `300000`                          | Global smoke timeout budget (default 300000ms / 5 minutes).              |

## Backup verify runner (release ops)

`pnpm backup:verify` expects these process env vars at runtime:

| Variable                   | Required | Example                    | Notes                                                    |
| -------------------------- | -------- | -------------------------- | -------------------------------------------------------- |
| `BACKUP_S3_BUCKET`         | Yes      | `studioos-backups-staging` | S3 bucket that stores backup artifacts.                  |
| `BACKUP_S3_PREFIX`         | No       | `postgres/`                | Prefix used when discovering latest backup object.       |
| `BACKUP_AWS_REGION`        | Yes      | `us-east-1`                | Region used for S3 backup discovery/download.            |
| `BACKUP_VERIFY_TIMEOUT_MS` | No       | `600000`                   | Timeout budget for restore drill workflow.               |
| `BACKUP_MIN_ORG_ROWS`      | No       | `0`                        | Minimum expected `Organization` row count after restore. |

## Launch health and post-launch review (release ops)

`pnpm launch:health` / `pnpm launch:post-review` expect these process env vars at runtime:

| Variable                 | Required | Example                           | Notes                                                  |
| ------------------------ | -------- | --------------------------------- | ------------------------------------------------------ |
| `LAUNCH_BASE_URL_API`    | Yes      | `https://staging-api.example.com` | API base URL used by launch health/review commands.    |
| `LAUNCH_AUTH_TOKEN`      | No       | `eyJ...`                          | Bearer token for protected launch/analytics endpoints. |
| `LAUNCH_ORGANIZATION_ID` | No       | `org_smoke_123`                   | Optional org filter for launch KPI review queries.     |
