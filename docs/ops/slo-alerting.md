# SLO Dashboard and Alerting Baseline

This baseline uses Prometheus metrics + alert rules and Grafana dashboards committed in-repo.

## SLO spec

- `ops/slo/slo-spec.v1.yaml`

Targets:

- API availability >= 99.9%
- API p95 latency: read < 500ms, write < 900ms
- Webhook success rate >= 99.5%
- Queue lag: notifications < 60s, media-jobs < 300s
- Worker job failure rate < 2% (rolling)

## Metrics exposed

`GET /metrics` includes:

- `studioos_http_requests_total`
- `studioos_http_errors_total`
- `studioos_api_read_latency_ms_*` histogram
- `studioos_api_write_latency_ms_*` histogram
- `studioos_queue_depth{queue="..."}`
- `studioos_queue_lag_seconds{queue="..."}`
- `studioos_webhook_processed_total`
- `studioos_webhook_failed_total`
- `studioos_worker_jobs_total{worker="...",status="success|failure"}`

## Dashboard definitions

- `ops/grafana/api-health.json`
- `ops/grafana/queue-health.json`
- `ops/grafana/webhook-reliability.json`
- `ops/grafana/worker-reliability.json`

## Alert rules

- Fast burn: `ops/prometheus/alerts/slo-fast-burn.yaml`
- Slow burn: `ops/prometheus/alerts/slo-slow-burn.yaml`

Route integration uses env placeholders:

- `ALERT_WEBHOOK_URL`
- `ALERT_ROUTING_KEY`

## Synthetic route check

```bash
pnpm slo:synthetic-check
```

This sends a synthetic alert payload to `ALERT_WEBHOOK_URL` and writes:

- `artifacts/slo/synthetic-check.json`
- `artifacts/slo/synthetic-check.md`

By default this check is blocked in production unless `SLO_SYNTHETIC_ALLOW_IN_PROD=true`.
