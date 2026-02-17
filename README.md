# StudioOS Monorepo

This repository uses `pnpm` workspaces and Turborepo to orchestrate builds, linting, formatting checks, and type checks across applications, services, packages, and infrastructure placeholders.

## Workspace layout

- `apps/mobile_flutter`
- `apps/web_nextjs`
- `apps/api_nestjs`
- `services/media_worker_python`
- `services/pricing_worker_python`
- `packages/api_contracts_openapi`
- `packages/shared_ts`
- `infra/terraform`
- `docs/architecture`

## Quick start

```bash
pnpm install
pnpm build
pnpm lint:all
pnpm format:check
pnpm typecheck:all
```

## Tooling standards

- TypeScript: ESLint + Prettier + strict `tsconfig`
- Flutter: `flutter_lints` + format check
- Python: Ruff + Black + MyPy
