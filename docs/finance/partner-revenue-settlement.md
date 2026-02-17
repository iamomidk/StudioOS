# Partner Revenue Share Settlement Engine (RC-34)

## Scope

RC-34 adds settlement accounting primitives for partner revenue share agreements with accrual computation, adjustment carry-forward, payout lifecycle, and reconciliation-grade reporting.

## Domain Models

- `SettlementPartner`, `SettlementAgreement`, `SettlementRevenueShareRule`
- `SettlementPeriod`, `SettlementAccrualEntry`, `SettlementAdjustmentEntry`
- `SettlementStatement`, `SettlementPayoutInstruction`

## API Endpoints

- `POST /billing/partner-settlement/agreements`
- `POST /billing/partner-settlement/agreements/:agreementId/periods`
- `POST /billing/partner-settlement/periods/:periodId/compute`
- `POST /billing/partner-settlement/periods/:periodId/adjustments`
- `PATCH /billing/partner-settlement/periods/:periodId/status`
- `GET /billing/partner-settlement/periods`
- `GET /billing/partner-settlement/periods/:periodId/report`

## Lifecycle and Controls

- Period states: `draft -> review -> approved -> paid -> reconciled`, with `on_hold/release` controls.
- Statements are immutable snapshots per period; corrections use adjustment entries.
- Carry-forward adjustments are automatically applied on next period compute.
- All period/agreement lifecycle actions emit audit log entries.

## Reporting

The report payload includes:
- partner identity,
- accrued/adjusted/payable totals,
- payout status/reference and variance,
- lifecycle timestamps and entry counts.
