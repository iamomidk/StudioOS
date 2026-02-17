# Contract Lifecycle Automation (RC-32)

## Scope

RC-32 adds a contract lifecycle baseline for MSA/SOW-style agreements with immutable versions, approval state, signature webhook updates, renewal scheduling, and searchable contract records.

## Data Model

- `ContractClauseSet`: reusable clause template with required clause keys.
- `Contract`: top-level contract record, lifecycle status, signature status, current version pointer.
- `ContractVersion`: immutable snapshot per version with clause keys and missing mandatory clause list.
- `ContractAmendment`: lineage from one version to another with reason.
- `ContractRenewalSchedule`: renewal date + reminder policy.
- `ContractApprovalFlow` + `ContractApprovalStep`: approval matrix and step-level decisions.

## API Endpoints

- `POST /contracts/clause-sets`: create template.
- `POST /contracts`: create draft contract with version `1` and approval flow.
- `POST /contracts/:contractId/approve-step`: approve/reject one approval step.
- `POST /contracts/:contractId/advance`: lifecycle transitions.
- `POST /contracts/:contractId/signature-webhook`: provider-agnostic signature state update.
- `POST /contracts/:contractId/amendments`: create new version + amendment lineage.
- `POST /contracts/:contractId/renewal-schedule`: upsert renewal policy.
- `GET /contracts`: filter by org/status/type/min value.

## Policy Guards

- Mandatory clauses are validated before `send_for_signature`.
- High-value (`>= 250000 cents`) or high-risk contracts require dual approvals (`manager` and `owner`).
- Contract and signature transitions are audited in `AuditLog`.

## Notes

- Signed snapshots are immutable; changes require amendment/version increment.
- Billing linkage is preserved at contract metadata level and can be extended to explicit plan-version binding in follow-up work.
