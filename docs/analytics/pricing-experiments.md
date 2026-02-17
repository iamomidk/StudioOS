# Pricing Experiments

RC-06 introduces a server-side pricing experiment framework for pilot cohorts. The framework is feature-flagged and defaults to baseline behavior.

## Feature flags

- `FEATURE_PRICING_EXPERIMENTS_ENABLED`: Enables experiment evaluation.
- `PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH`: Emergency stop for all experiments.

Both are `false` by default.

## Domain model

- `PricingExperiment`: experiment metadata and lifecycle (`draft`, `active`, `paused`, `stopped`).
- `PricingVariant`: weighted variants, optional `pricingMultiplier`.
- `PricingAllocationRule`: target scope (`all`, `organization`, `cohort`).
- `PricingExposureLog`: immutable exposure entry when pricing is rendered/evaluated.
- `PricingConversionEventLink`: immutable link from exposure to conversion events (`quote_accepted`, `booking_created`, `invoice_paid`).

## Deterministic assignment

Assignment uses stable hashing (`sha256`) of `experimentId:subjectKey`:

- subject defaults to `organizationId`
- optional `userId` switches to per-user bucketing
- weighted variant allocation supports A/B and multi-variant tests

The same subject always resolves to the same variant while weights are unchanged.

## Guardrails

An experiment is applied only when all checks pass:

1. Global feature flag enabled.
2. Global kill switch disabled.
3. Organization is pilot (`pilotOrg=true`).
4. Experiment is active and inside start/end window.
5. Experiment kill switch disabled.
6. Experiment exposure cap not exceeded.
7. Allocation rules match org/cohort.

If any check fails, baseline pricing is returned.

## API endpoints

All endpoints require access token.

- `POST /analytics/pricing-experiments/evaluate`
  - evaluates applicable experiment and logs exposure idempotently
- `POST /analytics/pricing-experiments` (Owner/Manager)
- `PATCH /analytics/pricing-experiments/:experimentId/activate` (Owner/Manager)
- `PATCH /analytics/pricing-experiments/:experimentId/pause` (Owner/Manager)
- `PATCH /analytics/pricing-experiments/:experimentId/stop` (Owner/Manager)
- `GET /analytics/pricing-experiments/:experimentId/metrics` (Owner/Manager)
- `GET /analytics/pricing-experiments/dashboard/summary` (Owner/Manager)

## Metrics payload

Per variant metrics include:

- exposures
- `quoteAccepted`, `bookingCreated`, `invoicePaid`
- conversion rates from exposures

This supports quick dashboard rendering without direct SQL access.

## Kill switch behavior

- Global kill switch reverts to baseline for all orgs immediately.
- Per-experiment kill switch disables only that experiment.
- `paused`/`stopped` experiments are excluded from assignment.

## Notes

- Evaluation and attribution run server-side to avoid client tampering.
- Exposure writes are append-only with optional idempotency key for repeated renders.
- Existing pricing behavior is unchanged when experiments are disabled.
