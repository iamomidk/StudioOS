# Runbook: Payment Webhook Failures

Owner: Billing Engineer

1. Inspect `/billing/payments/webhook/:provider` error rate and last successful event ID.
2. Validate `PAYMENT_WEBHOOK_DEMO_SECRET` / provider signature secret rotation state.
3. Check idempotency table (`paymentWebhookEvent`) for duplicate/replay anomalies.
4. Replay failed provider events from provider dashboard in chronological order.
5. Verify invoice/payment state convergence after replay.
6. If unresolved, disable automated retries and switch to manual reconciliation.
