# Support Workflow

RC-08 adds support intake and triage tooling with audited safe admin actions.

## In-app issue intake

Applications submit support tickets to `POST /support/tickets` with contextual metadata:

- `organizationId`
- `routePath` / `screenName`
- `appVersion`
- `correlationId` / `requestId`
- `severity` (`p0`..`p3`)
- optional attachments (type/size constrained)

## Ticket lifecycle

Supported statuses:

- `open`
- `triaged`
- `in_progress`
- `resolved`
- `closed`

Ticket severity:

- `p0`, `p1`, `p2`, `p3`

## Support console endpoints

Owner/Manager RBAC required:

- `GET /support/tickets`
- `GET /support/tickets/:ticketId`
- `PATCH /support/tickets/:ticketId/status`
- `POST /support/tickets/:ticketId/notes`

Ticket detail includes linked diagnostics:

- recent org audit logs
- recent failure/error audit log subset

## Safe admin actions

Owner/Manager RBAC + feature flag required (`FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED=true`):

- `POST /support/admin-actions/resend-notification`
- `POST /support/admin-actions/retry-webhook`
- `POST /support/admin-actions/requeue-job`

All actions create immutable audit entries under `support.admin.*`.

## Abuse controls

- Submission rate limit per org/user (`SUPPORT_MAX_SUBMISSIONS_PER_MINUTE`)
- Attachment MIME allowlist (`SUPPORT_ALLOWED_ATTACHMENT_TYPES`)
- Attachment max bytes (`SUPPORT_MAX_ATTACHMENT_BYTES`)

## Priority alerting

When configured (`SUPPORT_ALERT_WEBHOOK_URL`), P0/P1 ticket creation triggers best-effort alert webhooks.

## Security constraints

- No direct DB mutation tooling is exposed in UI APIs.
- Console endpoints are strict RBAC protected.
- Admin actions are feature-flagged and auditable.
