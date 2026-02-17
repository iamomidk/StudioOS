# Post-Deploy Smoke Tests

`pnpm smoke:test` runs a short RC smoke suite against deployed URLs (staging/prod) and emits both JSON and Markdown reports.

## Command

```bash
pnpm smoke:test
```

## Required env vars

- `SMOKE_BASE_URL_API`
- `SMOKE_BASE_URL_WEB`
- `SMOKE_USER_EMAIL`
- `SMOKE_USER_PASSWORD`
- `SMOKE_ORG_ID`
- `SMOKE_CHECK_TOKEN`

Optional:

- `SMOKE_TIMEOUT_MS` (default `300000`)

## Checks executed

1. API `/health`
2. Web `/` and `/dashboard` reachability
3. Worker heartbeat (`GET /health/workers`)
4. Auth login + profile
5. Lead create + convert
6. Quote create + send + accept (booking draft)
7. Rental reservation
8. Invoice draft create
9. Queue enqueue/consume probe (`POST /health/queue-smoke`)
10. Storage presign upload URL contract
11. Cleanup (`POST /health/smoke-cleanup`)

## Output artifacts

- `artifacts/smoke/summary.json`
- `artifacts/smoke/summary.md`

Each check includes status and duration. Any failed check returns non-zero exit status and yields final verdict `NO-GO`.

## CI integration

`post-deploy-smoke` in `.github/workflows/ci-cd.yml` runs after staging deploy on `main` pushes and uploads smoke report artifacts.

## Safety model

- Smoke endpoints are gated by API env vars:
  - `SMOKE_OPS_ENABLED=true`
  - `SMOKE_CHECK_TOKEN=<secret value>`
- Smoke data uses dedicated smoke tenant credentials.
- Cleanup runs on every smoke execution and is idempotent for missing IDs.
