# Pilot KPI Telemetry

This telemetry pack provides pilot KPI instrumentation and cohort-aware KPI rollups.

## Event taxonomy

Versioned schema: `docs/analytics/event-taxonomy.v1.yaml`

Tracked events:

- `lead_created`
- `lead_converted`
- `quote_sent`
- `quote_accepted`
- `booking_created`
- `booking_conflict_detected`
- `rental_reserved`
- `rental_picked_up`
- `rental_returned`
- `incident_created`
- `invoice_issued`
- `invoice_paid`
- `invoice_overdue`

Envelope fields emitted:

- `timestamp`
- `org_id`
- `actor_role`
- `source` (`web`, `mobile`, `api`)
- entity identifiers when applicable (`lead_id`, `quote_id`, `booking_id`, `rental_order_id`, `invoice_id`)
- `pilot_org`
- `pilot_cohort_id`

## KPI endpoint

`GET /analytics/pilot-kpis`

Query params:

- `organizationId` (optional)
- `pilotCohortId` (optional)
- `days` (default `7`, min `7`, max `90`)

Returns:

- totals by event
- KPI values:
  - lead-to-booking conversion rate
  - median quote response turnaround
  - booking conflict rate
  - on-time delivery rate
  - rental utilization rate
  - incident rate
  - DSO (median days sales outstanding)
- rolling day trend for the selected window

Quality endpoint:

- `GET /analytics/pilot-kpis/quality`

## Data quality guardrails

- Append-only `AnalyticsEvent` storage
- `idempotencyKey` uniqueness to prevent duplicate writes
- quality checks report missing required fields and duplicate idempotency keys

## Backfill note

For pre-telemetry records, run a one-time replay from audit/business tables into `AnalyticsEvent` using deterministic `idempotencyKey` values to avoid duplicates.
