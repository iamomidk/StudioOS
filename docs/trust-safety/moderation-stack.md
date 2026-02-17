# Trust & Safety Moderation Stack (RC-33)

## Scope

RC-33 adds a deterministic moderation baseline for listings/messages/uploads/transactions with policy versioning, case review, sanctions, appeals, abuse-report intake, and metrics payloads.

## Models

- `ModerationPolicy`, `ModerationPolicyVersion`
- `ModerationCase`, `ModerationDecision`
- `ModerationAppeal`, `ModerationSanction`
- `ModerationAbuseReport`

## API Surface

- `POST /trust-safety/policies`: create active policy and version.
- `POST /trust-safety/moderate`: rule-based detection and case creation.
- `GET /trust-safety/cases`: queue/search view with decisions/appeals/sanctions.
- `POST /trust-safety/cases/:caseId/decisions`: moderation actioning (`allow/warn/throttle/quarantine/block/escalate`).
- `POST /trust-safety/cases/:caseId/appeals`: due-process appeal flow.
- `POST /trust-safety/reports`: abuse-report intake with attachment/quarantine metadata.
- `GET /trust-safety/metrics`: dashboard input payload.

## Enforcement and Review

- Rule matching is deterministic via policy keyword rules.
- Every case decision and appeal creates immutable audit entries.
- Sanctions are time-bound (`active/expired/revoked`) and linked to case lineage.

## Notes

- Classifier integration remains provider-agnostic via `classifierConfig` placeholder on policy versions.
- Decision reason codes are preserved for explainability and appeal review.
