# Release Readiness Audit

`pnpm rc:audit` runs a fail-fast RC gate sequence and writes both machine-readable and human-readable summaries.

## Command

```bash
pnpm rc:audit
```

## Gate order

1. `pnpm lint:all`
2. `pnpm typecheck:all`
3. `pnpm test`
4. `pnpm --filter @studioos/apps-api_nestjs test` (critical e2e/api path)
5. `pnpm audit --json` (policy: fail on High/Critical, warn on Medium)
6. `pnpm openapi:drift-check`
7. `pnpm --filter @studioos/apps-api_nestjs prisma:migrate:verify`

If a blocking gate fails, subsequent gates are marked `SKIPPED` and the command exits non-zero.

## Artifacts

- `artifacts/rc-audit/summary.json`
- `artifacts/rc-audit/summary.md`

`summary.json` fields:

- `task`
- `startedAt`, `finishedAt`, `durationMs`
- `gates[]` with `name`, `status`, `durationMs`, `failures[]`
- `verdict` (`GO` or `NO-GO`)

## CI workflow

Workflow: `.github/workflows/release-readiness.yml`

Triggers:

- tags matching `v*.*.*-rc*`
- manual dispatch

The workflow always uploads `artifacts/rc-audit/*` for troubleshooting, including failed runs.

## Interpreting verdict

- **GO**: all blocking gates passed.
- **NO-GO**: at least one blocking gate failed. Release candidate must not proceed until resolved.
