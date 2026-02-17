# Risk Scoring Rollout

RC-13 introduces deterministic fraud/risk scoring with phased rollout controls.

## Modes

Configured with `RISK_SCORING_MODE`:

- `OFF`
- `ADVISORY`
- `SOFT_ENFORCE`
- `HARD_ENFORCE`

Additional controls:

- `RISK_SCORING_GLOBAL_KILL_SWITCH`
- `RISK_SCORING_BYPASS_ORG_IDS`
- `RISK_SCORING_ENFORCE_COHORT_IDS`

Default is advisory to prevent unintended user-facing blocking.

## Signals

Deterministic baseline uses:

- organization/account age
- prior incident/dispute audit volume
- active rental count
- payment anomalies (failed/refunded)
- booking velocity window
- transaction amount exposure

Output:

- `riskScore` (0-100)
- `riskLevel` (`low`, `medium`, `high`)
- `reasonCodes`

## Policy Hooks

Rental flow:

- advisory: no block
- soft enforce: manual review + deposit multiplier
- hard enforce: block creation

Payment flow:

- advisory: no block
- soft enforce: additional verification marker
- hard enforce: block processing

## Internal Endpoints

- `GET /risk/explain` (admin/owner-manager)
- `GET /risk/dashboard`
- `PATCH /risk/false-positives/:evaluationId/resolve`

## Monitoring

Dashboard payload includes:

- score distribution by level
- block/review impact rates
- false-positive queue count

Risk evaluations are persisted in `RiskEvaluation` for explainability and review.

## Safety

- Kill switch disables enforcement immediately.
- Bypass allowlist supports emergency org exclusions.
- Reason codes are internal-only and not exposed in public-facing payloads.
