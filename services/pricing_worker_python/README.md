# pricing_worker_python

FastAPI-based pricing worker service with:

- `/health` endpoint
- queue-consumer iteration for `pricing-jobs`
- deterministic baseline pricing recommendation algorithm
- API callback lifecycle updates (`processing`, `completed`, `failed`)

## Recommendation output

Each processed job returns:

- `suggestedDailyRateCents`
- `confidence`
- `explanation`

The baseline algorithm combines utilization history, category factor, and seasonality factor.
