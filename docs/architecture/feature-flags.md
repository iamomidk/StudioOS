# Feature Flags

Task 40 feature skeleton flags:

- `FEATURE_MARKETPLACE_ENABLED`
- `FEATURE_DISPUTES_ENABLED`
- `FEATURE_PUBLIC_LAUNCH_ENABLED`
- `PUBLIC_MODULES_GLOBAL_KILL_SWITCH`
- `FEATURE_PRICING_EXPERIMENTS_ENABLED`
- `PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH`
- `FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED`

Rollout targeting controls:

- `PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS`
- `PUBLIC_ROLLOUT_ALLOWLIST_COHORT_IDS`
- `PUBLIC_ROLLOUT_PERCENTAGE`
- `PUBLIC_ROLLOUT_HASH_SALT`

## Marketplace Search API

- Endpoint: `GET /marketplace/search`
- Filters: category, location, date range, min/max price
- Ranking v1 placeholder: availability + rating + distance placeholder
- Audit event: `marketplace.search.executed`

## Disputes Module

- Endpoints:
  - `POST /disputes`
  - `GET /disputes`
  - `PATCH /disputes/:disputeId/status`
- Statuses: `open`, `under_review`, `resolved`, `rejected`
- Evidence linkage: `evidenceLink` payload field
- Audit events:
  - `dispute.created`
  - `dispute.status.updated`
