# Strategic Roadmap Instrumentation (RC-35)

## Scope

RC-35 adds a versioned strategic metrics framework that links north-star and leading indicators to generated weekly/monthly scorecards, variance tracking, confidence estimation, and experiment impact linkage.

## Data Model

- `StrategicMetricDefinition`, `StrategicMetricDefinitionVersion`
- `StrategicScorecard`, `StrategicScorecardMetric`
- `StrategicExperimentImpact`

## API Endpoints

- `POST /analytics/roadmap/definitions`
- `PATCH /analytics/roadmap/definitions/:definitionId/version`
- `POST /analytics/roadmap/scorecards/generate`
- `GET /analytics/roadmap/scorecards`

## What Gets Computed

- scorecard window (`weekly`/`monthly`) with trend summary payload,
- per-metric value, target, variance, anomaly flag, and confidence,
- north-star on-track/off-track result,
- optional experiment linkage (`pre/post/delta`) per metric.

## Governance

- every definition version change is auditable,
- formulas/targets are immutable by version,
- scorecards preserve the exact definition version used at generation time.
