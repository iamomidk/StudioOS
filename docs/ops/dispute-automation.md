# Dispute Automation

RC-12 adds deterministic policy-driven dispute triage, routing, evidence scoring, and override controls.

## Policy Model

- Policy version is captured on dispute creation via `DISPUTE_POLICY_VERSION`.
- Policy decisions are non-retroactive: each dispute keeps the policy version used at creation time.
- Rule hits are recorded in `decisionTrace` for explainability.

## Inputs

Dispute create payload supports:

- `disputeType`: `damage`, `late_return`, `payment`, `other`
- `rentalValueCents`
- `customerRiskTier`, `providerRiskTier`: `low`, `medium`, `high`
- `evidence` object (photos, notes, timestamps, actor, optional geotag + contentType)

## Deterministic Evidence Scoring (v1)

Score components (0-100):

- Required artifacts: check-in photo, check-out photo, note, occurredAt timestamp, actor id
- Metadata validity: bounded timestamp age and content type allowlist
- Optional geotag bonus

If score is low, `missingEvidenceTemplateKey` is populated to request missing evidence.

## Automation Actions

At dispute creation, policy engine determines:

- `severity`
- `assignedTeam`
- `slaClass`
- `slaTargetMinutes`
- `missingEvidenceTemplateKey` (when applicable)

## Human Override Workflow

Endpoint:

- `PATCH /disputes/:disputeId/override`

Requirements:

- Mandatory `reason`
- Optional override values: `severity`, `assignedTeam`, `slaClass`
- Every override is audited (`dispute.policy.overridden`) with before/after values

## Metrics Endpoint

- `GET /disputes/metrics?organizationId=...`

Returned metrics include:

- auto-triage rate
- evidence completeness distribution
- mean time to first action
- resolution rate by dispute type

## Constraints

- No opaque ML decisions; deterministic rule set only.
- No auto-resolve behavior.
- Override path remains human-driven and auditable.
