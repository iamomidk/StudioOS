# Load Testing Automation

RC-26 introduces a repeatable performance engineering framework with deterministic runs and CI regression gates.

## Performance target catalog

Target catalog lives in:

- `perf/config/targets.json`

SLO-linked flow targets include:

- auth login
- lead -> quote -> booking
- rental reserve/pickup/return
- invoice creation + payment webhook ingest

## One-command execution

Run:

```bash
pnpm perf:test
```

This runs:

1. deterministic synthetic data manifest generation
2. load scenarios (`smoke`, `baseline`, `peak`, `soak`)
3. report + bottleneck export

## Safety guardrails

- Production protection: runner blocks production-like targets unless `PERF_ALLOW_PRODUCTION=true`.
- Reproducibility controls:
  - `PERF_SEED`
  - profile config (`vus`, `duration_s`)
  - explicit scenario list via `PERF_SCENARIOS`

## Scenario definitions

k6 scenarios are in `perf/k6/`:

- `smoke.js`
- `baseline.js`
- `peak.js`
- `soak.js`

If `k6` is unavailable, runner uses deterministic simulated mode. Set `PERF_USE_SIMULATED=true` explicitly for CI-safe fallback.

## Profiling hooks captured

- DB query duration histogram (`studioos_db_query_duration_ms_*`)
- slow query counters/samples (`studioos_db_slow_queries_total`, `studioos_db_slow_query_sample_ms`)
- queue lag metrics via `/metrics`

Prisma query profiling is recorded process-local and exported through `/metrics`.

## Outputs

- `artifacts/perf/report.json`
- `artifacts/perf/report.md`
- `artifacts/perf/optimization-backlog.json`
- `artifacts/perf/baseline-latest.json`
- `artifacts/perf/synthetic-data.json`

`report.json` includes:

- pass/fail verdict (`GO`/`NO-GO`)
- p50/p95/p99 and error rates per scenario
- baseline comparison and drift analysis
- profiling snapshot
- top bottlenecks with estimated impact

## CI regression gate

Workflow: `.github/workflows/performance-regression.yml`

- triggers on `release/**` branch pushes and manual dispatch
- runs smoke + baseline profiles
- fails when p95/error-rate drift exceeds configured thresholds
- uploads perf artifacts for analysis
