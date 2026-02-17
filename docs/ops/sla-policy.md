# SLA Policy and Breach Alerting

RC-09 adds support-ticket SLA tracking with breach states, alerts, dashboards, and weekly export reporting.

## Policy model

SLA policies are config-driven through env values and versioned via `SLA_POLICY_VERSION`.

Per severity targets:

- first response target minutes (`SLA_P{0..3}_FIRST_RESPONSE_MINUTES`)
- resolution target minutes (`SLA_P{0..3}_RESOLUTION_MINUTES`)

Clock mode:

- 24/7 mode (`SLA_BUSINESS_HOURS_ONLY=false`)
- business-hours mode (`SLA_BUSINESS_HOURS_ONLY=true`) with `SLA_BUSINESS_HOUR_START`/`SLA_BUSINESS_HOUR_END`

Each created support ticket snapshots policy values into `SupportTicketSla` for historical accuracy.

## SLA states

- `healthy`
- `at_risk`
- `breached`
- `recovered`

State transitions are evaluated on support status changes and responder notes.

## Timers and transitions

- clock starts at ticket creation
- first response marked on first triage/progress status change or first responder note
- resolved/closed marks resolution time
- reopening resumes evaluation

## Alerts

If configured (`SLA_ALERT_WEBHOOK_URL`), SLA state transitions and breach events are sent as webhook alerts.

## Endpoints

Owner/Manager only:

- `GET /sla/dashboard?organizationId=...`
- `GET /sla/weekly-report?organizationId=...`

Dashboard includes:

- compliance % by severity
- MTTA / MTTR
- breach trend

Weekly report includes:

- support SLA aggregates
- optional workflow SLA aggregates (lead->quote, quote->booking observed pairs)

## Testing

- e2e verifies breach/recovery and dashboard/report endpoints
- unit tests verify business-hours and 24/7 due-time calculations
