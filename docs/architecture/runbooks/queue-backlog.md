# Runbook: Queue Backlog Handling

Owner: Backend Lead

1. Identify saturated queue (`notifications`, `invoice-reminders`, `media-jobs`, `pricing-jobs`).
2. Check consumer health and recent deploy changes.
3. Scale worker replicas and monitor drain rate.
4. Route poison jobs to dead-letter queue and preserve payloads.
5. Apply retry/backoff tuning if transient failure patterns are detected.
6. Confirm backlog returns to steady-state threshold.
