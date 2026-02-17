# Runbook: Regional Failback Procedure

Owner: Platform Lead

1. Validate recovered region health (`/health`, `/health/failover`, DB/queue metrics).
2. Remove maintenance mode for recovered region.
3. Shift traffic back in controlled percentages.
4. Compare critical side-effect counts (billing/notifications/webhooks) for duplicates.
5. Return `FAILOVER_MODE` to `off` for normal single-region baseline.
6. Complete post-failback review and update ADR/runbook learnings.
