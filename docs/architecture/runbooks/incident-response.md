# Runbook: Incident Response

Owner: Platform Lead

1. Acknowledge incident in on-call channel within 5 minutes.
2. Capture impact scope (users, services, regions, start time).
3. Triage severity:
- SEV-1: production outage or data loss risk
- SEV-2: major degraded functionality
- SEV-3: minor degradation/workaround available
4. Mitigate immediate blast radius (scale down faulty deploy, feature-flag off, traffic shift).
5. Communicate updates every 15 minutes until mitigation.
6. Open post-incident action items with owners and deadlines.
