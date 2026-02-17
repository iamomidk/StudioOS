# mobile_flutter

Flutter mobile shell with:

- Riverpod state management
- GoRouter route shell (`/splash`, `/login`, `/profile`, `/rentals`)
- secure token storage via `flutter_secure_storage`
- generated API client integration for auth + rentals/evidence endpoints
- Isar-backed profile cache with stale-while-revalidate behavior and offline fallback
- field operations flow with assigned rentals, pickup/return transitions, and evidence capture
- offline action queue with retry sync for status/evidence operations

## Dart API client generation

- `pnpm --filter @studioos/apps-mobile_flutter generate:dart-client`
  regenerates `lib/generated/studioos_api_client.dart` from
  `packages/api_contracts_openapi/openapi.yaml`.

The generated client includes:

- Bearer-token auth header injection (`accessTokenProvider`)
- Centralized HTTP error mapping (`StudioOsApiException`)
