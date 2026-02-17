# Workflow Automation Builder

RC-22 adds a no-code-style workflow automation engine for operations workflows.

## Domain Model

- `Workflow`
- `WorkflowVersion`
- `WorkflowTrigger`
- `WorkflowConditionGroup`
- `WorkflowAction`
- `WorkflowExecutionLog`

## Supported Trigger Sources

- `lead_created`
- `lead_converted`
- `booking_created`
- `booking_updated`
- `rental_state_changed`
- `invoice_overdue`
- `invoice_paid`
- `dispute_opened`
- `dispute_resolved`

## Condition System

Condition groups support nested `AND`/`OR` trees with comparison operators:

- `eq`, `neq`, `in`, `contains`
- `gt`, `gte`, `lt`, `lte`

## Actions

- `send_notification`
- `create_ticket`
- `apply_label`
- `enqueue_job`
- `invoke_internal_endpoint` (allowlisted only)

Actions execute in deterministic order by `orderIndex`.

## Safety Controls

- Workflow `dryRunEnabled` mode.
- Per-workflow kill switch.
- Loop prevention via `maxExecutionsPerHour` per `workflow + entity`.
- Version windows via `activationStartsAt` / `activationEndsAt`.

## API Endpoints

- `GET /automation/workflows/schema`
- `POST /automation/workflows`
- `POST /automation/workflows/:workflowId/validate`
- `POST /automation/workflows/:workflowId/publish`
- `PATCH /automation/workflows/:workflowId/pause`
- `POST /automation/workflows/:workflowId/dry-run`
- `GET /automation/workflows/:workflowId/executions`
- `POST /automation/workflows/events/trigger`

Execution logs include trigger input, rule path, action results, and status (`success`, `skipped`, `blocked`, `failed`).
