# Partner API v1

Partner endpoints are exposed under `/api/partner/v1/*` and authenticated with partner API keys.

## Auth and tenant isolation

- Supply `x-partner-api-key: <keyId.secret>` (or `Authorization: Bearer <keyId.secret>`).
- Every request must include `organizationId` in query/body and it must match the credential tenant.
- Requests are scope-checked per endpoint.

## Supported scopes

- `leads:read`
- `leads:write`
- `bookings:read`
- `bookings:write`
- `inventory:read`
- `rentals:read`
- `rentals:write`
- `invoices:read`

## Endpoint surface (v1)

- `GET /api/partner/v1/leads`
- `POST /api/partner/v1/leads`
- `GET /api/partner/v1/bookings`
- `POST /api/partner/v1/bookings`
- `GET /api/partner/v1/bookings/:bookingId`
- `GET /api/partner/v1/inventory/availability`
- `POST /api/partner/v1/rentals`
- `GET /api/partner/v1/rentals/:rentalOrderId`
- `GET /api/partner/v1/invoices/:invoiceId`

## Idempotency and signing

- Write endpoints require `Idempotency-Key` header.
- Reusing the same key with a different payload returns `409`.
- When a credential is configured with request signing, requests must include `x-partner-signature` (HMAC-SHA256 of raw JSON payload).

## Quotas and errors

- Per-credential limits:
  - `requestsPerMinute`
  - `dailyQuota`
- Quota excess returns `429`.
- Missing scopes or tenant mismatch returns `403`.

## Versioning and deprecation policy

- Versioned base path: `/api/partner/v1`.
- Response headers:
  - `x-partner-api-version: v1`
  - `x-partner-api-deprecation-policy: /docs/api/partner-v1.md`
- Breaking changes will ship under a new major path (`/api/partner/v2`) with migration notes.

## Credential governance

Admin endpoints (owner/manager access token required):

- `POST /partner/credentials`
- `GET /partner/credentials`
- `POST /partner/credentials/:credentialId/rotate`
- `PATCH /partner/credentials/:credentialId/status`
- `GET /partner/credentials/usage/dashboard`

Credential create/rotate/revoke/suspend actions are audit logged.

## Quickstart (<30 minutes)

1. Create a partner credential as org owner/manager.
2. Save `rawApiKey` once (it is not re-shown).
3. Call `GET /api/partner/v1/leads?organizationId=<orgId>` with `x-partner-api-key`.
4. Call a write endpoint (`POST /api/partner/v1/leads`) with `Idempotency-Key`.
5. Import the Postman collection in `docs/api/partner-v1.postman_collection.json`.

## OpenAPI and collections

- Canonical contract: `packages/api_contracts_openapi/openapi.yaml`
- Postman collection: `docs/api/partner-v1.postman_collection.json`
