# Enterprise Billing Orchestration

RC-31 adds enterprise billing orchestration with seat, usage, and hybrid plan support.

## Domain models

- `BillingPlan`, `BillingPlanVersion`, `BillingPriceComponent`
- `BillingSubscription`, `BillingSubscriptionItem`
- `BillingMeter`, `BillingUsageRecord`
- `BillingTrueUpRecord`, `BillingInvoiceLine`
- `BillingSubscriptionSeatChangeLog`, `BillingAdjustmentRequest`

## Supported billing patterns

- Seat-only
- Usage-only
- Hybrid fixed + seat + usage

## Core flows

- Create plan/version with price components
- Create subscription
- Mid-cycle seat changes with proration delta tracking
- Idempotent usage ingestion via `dedupKey`
- Period close to issued invoice with explainable line items
- True-up generation for minimum commit
- Cancellation and auditable subscription history

## APIs

- `POST /billing/enterprise/plans`
- `POST /billing/enterprise/subscriptions`
- `PATCH /billing/enterprise/subscriptions/:subscriptionId/seats`
- `POST /billing/enterprise/subscriptions/:subscriptionId/usage`
- `POST /billing/enterprise/subscriptions/:subscriptionId/close-period`
- `PATCH /billing/enterprise/subscriptions/:subscriptionId/cancel`
- `GET /billing/enterprise/subscriptions/:subscriptionId/history`
- `POST /billing/enterprise/adjustments`
- `PATCH /billing/enterprise/adjustments/:adjustmentId`
- `GET /billing/enterprise/reports`

## Safeguards

- Duplicate usage ingestion is deduplicated by `(organizationId, dedupKey)`.
- Late-arrival policy enforced with fixed grace window.
- Negative invoice totals are blocked.
- High-quantity usage triggers anomaly audit + notification.
- Adjustments follow approval workflow and immutable audit trail.

## Reporting

Report endpoint provides:

- MRR/ARR summary (plan-driven)
- billed vs recognized usage view
- seat utilization by subscription
