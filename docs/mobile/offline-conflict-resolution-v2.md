# Mobile Offline Conflict Resolution v2

RC-21 introduces deterministic offline conflict handling for field operations.

## Mutation Log Contract

Queued operations now persist:

- `operation_id`
- `entity_type`
- `entity_id`
- `operation_type`
- `payload_hash`
- `local_timestamp`
- `base_version`
- `retry_count`
- `sync_state`

The queue remains append-only and never drops local data silently.

## Server Versioning and Conflict Payload

Rental status updates accept optional sync metadata:

- `baseVersion`
- `operationId`
- `deviceSessionId`
- `payloadHash`
- `retryCount`

If the provided base version is stale, API returns `409` with:

- `server_version`
- `conflicting_fields`
- `last_actor`
- `last_updated_at`

## Deterministic Merge Strategy

- Append-only evidence: append on sync replay.
- Status transitions: server-authoritative; client moves operation to manual review with rebase options.
- Conflict resolution options exposed in UI:
  - Keep Mine
  - Keep Server
  - Merge (preview payload marker)

## Retry, Backoff, Poison Queue

- Exponential backoff based on retry count.
- Max retry threshold moves operation to `manualReview` state.
- Manual-review operations stay visible until operator resolution.

## Diagnostics Endpoint

Support/admin can query per-device sync diagnostics:

- `GET /rentals/sync-diagnostics?organizationId=<id>&deviceSessionId=<id>&limit=<n>`

Data is sourced from `RentalSyncDiagnostic` records with operation metadata, conflict fields, and last sync error.
