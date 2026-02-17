# Delivery Pipeline

Task 37 baseline pipeline in GitHub Actions:

- Scope-aware change detection (`dorny/paths-filter`).
- PR and push quality gates (`lint:all`, `typecheck:all`, `test`, `build`).
- Staging deploy placeholders for API, web, and workers on `main`.
- Manual production gate through `workflow_dispatch` + `production` environment.
- Tagged release notes artifact generation for `v*.*.*` tags.

## Workflows

- `.github/workflows/ci-cd.yml`
- `.github/workflows/critical-e2e.yml`
- `.github/workflows/openapi-drift.yml`
- `.github/workflows/security-audit.yml`
- `.github/workflows/release-readiness.yml`
- `.github/workflows/post-launch-review.yml`
- `.github/workflows/daily-reconciliation.yml`
