# Architecture Docs

- `configuration.md`: Environment/configuration matrix and bootstrap behavior.
- `delivery.md`: CI/CD flow, staging/prod gates, and release notes pipeline.
- `feature-flags.md`: Feature-flagged module inventory and contract notes.
- `observability.md`: Logging, metrics, tracing, and error-reporting baseline.
- `permission-matrix.md`: RBAC actions and role allow/deny matrix.
- `runbooks/`: Incident, billing, queue, migration rollback, key rotation, and go-live runbooks.
- `security-baseline.md`: Security hardening checklist and baseline controls.

Additional operations/release docs live outside the architecture package:

- `../release/release-readiness.md`: RC gate runner, artifact schema, and CI usage.
- `../ops/smoke-tests.md`: Post-deploy smoke suite, required env, and cleanup behavior.
- `../ops/slo-alerting.md`: SLO targets, Prometheus/Grafana assets, and alert routing checks.
- `../ops/backup-restore.md`: Backup verification automation, restore drill, and manual fallback.
- `../ops/support-workflow.md`: Support intake/triage workflow, diagnostics, and safe admin actions.
- `../ops/sla-policy.md`: SLA policy config, breach states, dashboard/report endpoints, and alerting.
- `../ops/dispute-automation.md`: Deterministic dispute policy engine, evidence scoring, routing, and overrides.
- `../security/risk-scoring-rollout.md`: Advisory-to-enforcement risk scoring controls and explainability surfaces.
- `../release/public-launch.md`: Controlled rollout, kill switch, launch health, and post-launch review flow.
- `../analytics/pilot-kpis.md`: Pilot KPI definitions, endpoint contracts, and quality checks.
- `../analytics/pricing-experiments.md`: Pricing experiment model, evaluation endpoints, and guardrails.
- `../analytics/onboarding-funnel.md`: Onboarding funnel instrumentation, activation definition, and dashboard payloads.
- `../finance/reconciliation.md`: Billing reconciliation model, discrepancy workflows, and daily scheduling.
- `../api/partner-v1.md`: Partner API v1 auth/scopes/quotas, endpoint contract, and integration quickstart.
- `../enterprise/enterprise-readiness.md`: Enterprise SSO/SCIM-lite controls, policy toggles, and compliance export workflow.
- `../infra/multi-region-readiness.md`: Multi-region failover controls, regional headers, queue dedupe semantics, and drills.
- `../infra/adr-0001-multi-region-strategy.md`: Multi-region architecture decision record (single-writer + passive failover baseline).
- `../mobile/offline-conflict-resolution-v2.md`: Mobile mutation-log sync v2 contract, deterministic conflict handling, and diagnostics endpoint.
