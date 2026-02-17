# Public Launch Controls

## Scope

RC-10 adds controlled rollout defaults and launch operations artifacts for public release:

- Default-deny public rollout (`FEATURE_PUBLIC_LAUNCH_ENABLED=false`)
- Allowlist-based org/cohort enablement
- Percentage rollout bucketing
- Global kill switch for public modules
- Launch health command + dashboard payload
- 24h/7d post-launch review reports

## Rollout Configuration

Set in `apps/api_nestjs/.env`:

- `FEATURE_PUBLIC_LAUNCH_ENABLED`
- `PUBLIC_MODULES_GLOBAL_KILL_SWITCH`
- `PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS`
- `PUBLIC_ROLLOUT_ALLOWLIST_COHORT_IDS`
- `PUBLIC_ROLLOUT_PERCENTAGE` (0-100)
- `PUBLIC_ROLLOUT_HASH_SALT`

Behavior:

1. Public modules remain disabled unless `FEATURE_PUBLIC_LAUNCH_ENABLED=true`.
2. If `PUBLIC_MODULES_GLOBAL_KILL_SWITCH=true`, rollout is disabled immediately.
3. Explicit allowlist org/cohort entries are enabled first.
4. Remaining orgs are evaluated by deterministic hash bucket against `PUBLIC_ROLLOUT_PERCENTAGE`.

## Launch Health

- API dashboard payload: `GET /launch/health` (owner/manager only)
- Local/CI command: `pnpm launch:health`
- Artifacts:
  - `artifacts/launch-health/summary.json`
  - `artifacts/launch-health/summary.md`

The health payload includes:
- service health
- error budget burn estimate
- queue lag/depth
- payment webhook health
- worker success/failure totals

## Post-Launch Review

Generate 24h and 7d reports:

```bash
pnpm launch:post-review
```

Artifacts:
- `artifacts/launch-review/24h.json`
- `artifacts/launch-review/24h.md`
- `artifacts/launch-review/7d.json`
- `artifacts/launch-review/7d.md`

CI workflow: `.github/workflows/post-launch-review.yml`

## Checklist and Templates

- Machine-readable checklist: `docs/release/public-launch-checklist.json`
- Checklist view: `docs/release/public-launch-checklist.md`
- Comms templates:
  - `docs/release/templates/internal-go-live-announcement.md`
  - `docs/release/templates/pilot-to-public-migration.md`
  - `docs/release/templates/incident-status-update.md`

## Rollback

1. Set `PUBLIC_MODULES_GLOBAL_KILL_SWITCH=true` and deploy.
2. Set `PUBLIC_ROLLOUT_PERCENTAGE=0` and clear allowlists.
3. Keep `FEATURE_PUBLIC_LAUNCH_ENABLED=false` until post-incident review is complete.
4. Run `pnpm launch:health` and verify recovery.
