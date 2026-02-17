# Feature Flags

Task 40 feature skeleton flags:

- `FEATURE_MARKETPLACE_ENABLED`
- `FEATURE_DISPUTES_ENABLED`

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
