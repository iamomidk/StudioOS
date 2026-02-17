# Multi-Region Readiness Baseline

RC-16 establishes conservative multi-region controls with default single-region behavior.

## Configuration

- `REGION_ID`
- `PRIMARY_REGION`
- `FAILOVER_MODE` (`off|passive|active`)
- `REGION_DATA_POLICY` (`global|regional-boundary`)
- `TRAFFIC_SHIFT_PERCENTAGE`
- `TRAFFIC_SHIFT_HASH_SALT`
- `MAINTENANCE_MODE_REGIONS`
- `MAINTENANCE_BYPASS_TOKEN`

Defaults keep behavior single-region (`FAILOVER_MODE=off`).

## Runtime behavior

- API responses include:
  - `X-Serving-Region`
  - `X-Primary-Region`
  - `X-Failover-Mode`
  - `X-Region-Data-Policy`
- `GET /health/failover` returns region/failover/auth/queue readiness metadata.
- Global region guard enforces:
  - maintenance mode per region (`503` unless bypass token header is provided)
  - deterministic traffic shift in passive mode for non-primary regions

## Data strategy baseline

- Decision record: `docs/infra/adr-0001-multi-region-strategy.md`
- Baseline mode: single-writer primary region + passive failover traffic shifting.
- Data boundary policy is explicit via `REGION_DATA_POLICY` and surfaced in headers/health.

## Auth/session failover

- Auth verification is based on shared JWT secrets configured per region.
- `/health/failover` exposes token verification readiness (`tokenVerificationReady`).
- Operational requirement: keep signing/verification secrets synchronized across active regions.

## Queue locality and duplicate prevention

- Queue payloads carry region meta (`regionOrigin`, `failoverMode`, optional `dedupeKey`).
- Producer sets deterministic BullMQ `jobId` for critical jobs (invoice reminders, media jobs, optional notification dedupe key).
- Consumer has in-process dedupe guard for repeated notification dedupe keys.

## Failover drill (staging)

1. Set non-primary region:

- `REGION_ID=eu-west-1`
- `PRIMARY_REGION=us-east-1`
- `FAILOVER_MODE=passive`

2. Set `TRAFFIC_SHIFT_PERCENTAGE=0` and verify guarded requests return `REGION_TRAFFIC_SHIFTED`.
3. Set `TRAFFIC_SHIFT_PERCENTAGE=100` and verify normal responses + region headers.
4. Enable maintenance with `MAINTENANCE_MODE_REGIONS=eu-west-1` and validate bypass flow using `x-region-maintenance-bypass`.

## Runbooks

- Planned failover: `docs/architecture/runbooks/region-failover-planned.md`
- Unplanned outage: `docs/architecture/runbooks/region-outage-unplanned.md`
- Failback: `docs/architecture/runbooks/region-failback.md`
