# Runbook: DB Migration Rollback

Owner: Data Engineer

1. Stop write traffic to affected services.
2. Identify migration ID and scope from Prisma migration history.
3. Restore latest pre-migration snapshot if destructive schema change occurred.
4. Apply rollback SQL or forward-fix migration.
5. Run smoke tests for auth, bookings, rentals, billing.
6. Resume write traffic and monitor error rate for 30 minutes.
