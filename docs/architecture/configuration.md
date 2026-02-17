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

## apps/web_nextjs

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:3000` | Base URL for API requests from web app. |
| `NEXT_PUBLIC_APP_NAME` | No | `StudioOS` | Display/application name. |

## apps/mobile_flutter

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `API_BASE_URL` | Yes | `http://localhost:3000` | API endpoint for mobile app integration. |
| `SENTRY_DSN` | No | `` | Sentry DSN when mobile observability is enabled. |

## services/media_worker_python

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `MEDIA_WORKER_PORT` | No | `8101` | Local service listen port. |
| `API_BASE_URL` | Yes | `http://localhost:3000` | Callback target for job status updates. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Queue broker location. |
| `S3_BUCKET` | Yes | `studioos-media` | Media bucket name. |
| `AWS_REGION` | Yes | `us-east-1` | AWS region for object operations. |

## services/pricing_worker_python

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `PRICING_WORKER_PORT` | No | `8102` | Local service listen port. |
| `API_BASE_URL` | Yes | `http://localhost:3000` | Callback/API integration base URL. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Queue broker location. |

## Fail-fast behavior

`apps/api_nestjs` performs schema validation at bootstrap. Missing required variables abort startup with a non-zero exit code.
