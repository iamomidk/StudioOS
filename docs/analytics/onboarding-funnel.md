# Onboarding Funnel and Activation

RC-07 adds onboarding funnel instrumentation and activation analytics for pilot operations.

## Configurable funnel steps

`ONBOARDING_STEPS` controls the ordered funnel sequence:

- `org_created`
- `team_invited`
- `first_lead_created`
- `first_quote_sent`
- `first_booking_created`
- `first_rental_reserved`
- `first_invoice_issued`

The sequence can be changed through env config without code changes.

## Configurable activation definition

`ACTIVATION_REQUIRED_STEPS` defines activation achievement. Default:

- `first_booking_created`
- `first_invoice_issued`

If all required steps are present for an org, that org is activated.

## Event model and quality checks

- Append-only events are stored in `AnalyticsEvent`.
- Derived first-step events are recorded idempotently.
- Funnel output includes:
  - completion rates per step
  - median transition time between consecutive steps
  - drop-off between consecutive steps
  - missing-step anomalies
  - out-of-order event counts

## API endpoints

Owner/Manager access required.

- `GET /analytics/onboarding-funnel`
  - org/cohort-scoped funnel summary and quality checks
- `GET /analytics/onboarding-funnel/dashboard`
  - daily activation rate
  - weekly activation rate
  - cohort breakdown by `pilotCohortId`

## Backfill strategy

For existing orgs, RC-07 derives baseline onboarding events on read:

- `org_created` from `Organization.createdAt`
- `team_invited` when second membership exists
- first-step events from earliest matching domain events

All derived events use idempotency keys to avoid duplicates.
