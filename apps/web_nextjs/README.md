# web_nextjs

Next.js dashboard shell with:

- protected `/dashboard` route
- login route and auth cookies
- left navigation (`CRM`, `Bookings`, `Projects`, `Inventory`, `Rentals`, `Billing`)
- generated OpenAPI client integration for dashboard API calls

## API client generation

- `pnpm --filter @studioos/apps-web_nextjs generate:api-client`
  regenerates `src/generated/openapi.types.ts` from
  `packages/api_contracts_openapi/openapi.yaml`.

## Local run

- `pnpm --filter @studioos/apps-web_nextjs dev`
