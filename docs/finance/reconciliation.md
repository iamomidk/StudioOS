# Billing Reconciliation

RC-11 introduces a reconciliation engine that compares internal billing records against provider webhook events and produces discrepancy workflows for finance operations.

## Data Model

- `ReconciliationRun`: One execution for an org + period, with summary metrics and report snapshots.
- `ReconciliationItem`: Match result for an internal payment and/or provider event.
- `ReconciliationDiscrepancy`: Triageable discrepancy with status (`open`, `acknowledged`, `resolved`).
- `ReconciliationActionLog`: Immutable action history for discrepancy lifecycle operations.

## Discrepancy Types

- `MissingInternalRecord`
- `MissingProviderRecord`
- `AmountMismatch`
- `CurrencyMismatch`
- `StatusMismatch`
- `DuplicateChargeSuspected`

## API Endpoints

All endpoints below require owner/manager auth unless noted.

- `POST /billing/reconciliation/runs/trigger`
- `GET /billing/reconciliation/runs`
- `GET /billing/reconciliation/runs/:runId/report`
- `GET /billing/reconciliation/discrepancies`
- `PATCH /billing/reconciliation/discrepancies/:discrepancyId/acknowledge`
- `PATCH /billing/reconciliation/discrepancies/:discrepancyId/assign`
- `POST /billing/reconciliation/discrepancies/:discrepancyId/notes`
- `PATCH /billing/reconciliation/discrepancies/:discrepancyId/resolve`

Daily trigger endpoint (token-protected):

- `POST /billing/reconciliation/runs/daily`
- header: `x-reconciliation-token`

## Daily Scheduling

GitHub workflow:

- `.github/workflows/daily-reconciliation.yml`

Required secrets:

- `RECONCILIATION_BASE_URL`
- `RECONCILIATION_DAILY_TOKEN`

API env variable:

- `RECONCILIATION_DAILY_TOKEN`

## Report Output

Per run:

- JSON summary in `ReconciliationRun.reportJson`
- Markdown summary in `ReconciliationRun.reportMarkdown`

Includes:

- matched percent
- discrepancy counts by type
- total mismatch amount
- period totals for succeeded/refunded internal and provider records

## Ledger Safety

Reconciliation does not mutate historical ledger/invoice/payment rows. Resolution captures triage and reason trail. Any financial correction must be represented via adjustment entries in finance workflows.
