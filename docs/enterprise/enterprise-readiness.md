# Enterprise Readiness Controls

RC-15 adds enterprise controls for SSO policy enforcement, SCIM-lite provisioning hooks, org policy management, and compliance exports.

## SSO baseline

- Policy fields are configured per organization under `PATCH /enterprise/settings`:
  - `ssoEnforced`
  - `ssoProvider` (`saml` or `oidc`)
  - `ssoDomains`
- When `ssoEnforced=true`, password login (`POST /auth/login`) is rejected for members of that org.
- This preserves backward compatibility for non-enterprise orgs (`ssoEnforced=false` default).

## SCIM-lite provisioning hooks

- `POST /enterprise/provisioning/users`
  - Create/update user profile
  - Upsert org membership role
  - Optional MFA capability flag (`mfaEnabled`)
- `PATCH /enterprise/provisioning/users/:userId/deactivate`
  - Marks user deactivated
  - Revokes active refresh tokens
  - Access blocked after grace window (`ENTERPRISE_DEPROVISION_GRACE_SECONDS`)

## Policy controls

Per-organization policy fields:

- `sessionDurationMinutes`
- `mfaEnforced`
- `ipAllowlist`
- `retentionDays`
- `enterpriseScimEnabled`

Auth behavior:

- MFA policy requires enabled user MFA and a valid code (`000000` for deterministic baseline test mode).
- IP allowlist is validated by access-token guard when an allowlist is configured.

## Data governance controls

- `retentionDays` tracks policy configuration.
- Purge workflow:
  - `POST /enterprise/users/:userId/purge-requests`
  - `PATCH /enterprise/purge-requests/:requestId/approve`
- Purge approvals and executions are immutable audit entries.

## Compliance exports

Owner/manager-only exports:

- `GET /enterprise/exports/audit`
- `GET /enterprise/exports/admin-actions`
- `GET /enterprise/exports/access`

Each export records a compliance export row with metadata and row count.

## Access control and auditing

- Enterprise endpoints require `AccessTokenGuard + RolesGuard` and roles `owner|manager`.
- Policy/provisioning/purge/export operations are captured in `AuditLog`.

## Environment variables

- `ENTERPRISE_DEPROVISION_GRACE_SECONDS`
- `BREAK_GLASS_ADMIN_EMAIL`

Use placeholders only in env samples. No secrets are committed.
