# ADR-0001: Multi-Region Strategy Baseline

Status: Accepted
Date: 2026-02-17

## Context

StudioOS needs a controlled multi-region baseline without changing default single-region behavior.

## Decision

Use **single-writer with passive regional failover** as baseline:

- Primary region handles normal write traffic.
- Non-primary regions can be enabled in passive mode via deterministic traffic shift controls.
- Queue dedupe uses deterministic `jobId` keys to prevent duplicate critical side effects during failover retries.
- Region metadata is propagated via response headers and queue payload meta.

## Consequences

- Lower operational risk than active-active writes.
- Clear traffic-shift and maintenance toggles for staged failover drills.
- Future active-active expansion remains possible for bounded contexts, but not enabled by default.
