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
