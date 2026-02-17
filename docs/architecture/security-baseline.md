# Security Baseline Checklist

Task 34 completion checklist:

- [x] API rate limiting enabled (fixed-window per IP).
- [x] CORS origin allowlist enabled via environment configuration.
- [x] Security headers enabled (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [x] Strict DTO validation enabled globally (`whitelist`, `forbidNonWhitelisted`, `transform`).
- [x] Dependency vulnerability scan added to CI (`pnpm audit --audit-level high`).

## Notes

- Rate limiting defaults can be tuned with `RATE_LIMIT_TTL_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`.
- CORS defaults to an empty allowlist string; if empty, non-browser/no-origin requests are still allowed.
- The vulnerability audit currently runs in PR and `main` pushes.
