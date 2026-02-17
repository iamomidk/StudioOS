# Runbook: Unplanned Region Outage

Owner: On-call Incident Commander

1. Declare incident and identify affected region (`REGION_ID`).
2. Route traffic to healthy region(s): set passive mode and shift traffic in healthy region.
3. Enable maintenance mode for impacted region (`MAINTENANCE_MODE_REGIONS`).
4. Validate auth/token verification readiness and critical API health checks.
5. Confirm queue dedupe protections and monitor duplicate side effects.
6. Publish customer updates until service stability is restored.
