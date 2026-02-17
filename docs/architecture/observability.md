# Observability Baseline

Task 35 baseline includes:

- API structured request logs with correlation IDs (`x-correlation-id`).
- API metrics endpoint at `/metrics` with Prometheus-style counters.
- API environment toggles for Sentry and OpenTelemetry runtime hooks.
- Web/mobile Sentry DSN environment placeholders and bootstrap wiring.

## Verification notes

- Correlation IDs are accepted from incoming header or generated per request.
- `/metrics` exposes `studioos_http_requests_total` and `studioos_http_errors_total`.
- When `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are configured, runtime hooks are active.
