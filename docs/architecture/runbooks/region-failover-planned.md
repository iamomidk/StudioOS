# Runbook: Planned Regional Failover

Owner: Platform Lead

1. Confirm replication health and queue backlog below threshold.
2. Set `FAILOVER_MODE=passive` in target region and verify `GET /health/failover`.
3. Shift traffic gradually by increasing `TRAFFIC_SHIFT_PERCENTAGE`.
4. Monitor error rate, auth success rate, queue lag, and webhook outcomes.
5. If stable, maintain target percentage or promote as temporary primary.
6. Record change window, metrics, and approvals in incident log.
