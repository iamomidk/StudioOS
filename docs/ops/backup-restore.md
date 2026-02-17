# Backup and Restore Verification

This runbook and automation verify that the latest backup is not only present but restorable.

## Automated command

```bash
pnpm backup:verify
```

Outputs:

- `artifacts/backup-verify/report.json`
- `artifacts/backup-verify/report.md`

## Required env vars

- `BACKUP_S3_BUCKET`
- `BACKUP_S3_PREFIX` (optional prefix)
- `BACKUP_AWS_REGION`

Optional:

- `BACKUP_VERIFY_TIMEOUT_MS` (default `600000`)
- `BACKUP_MIN_ORG_ROWS` (default `0`)
- `ALERT_WEBHOOK_URL`
- `ALERT_ROUTING_KEY`

## What it validates

1. Discover latest backup object in S3.
2. Download backup and compute SHA256 checksum.
3. Start isolated ephemeral Postgres container.
4. Restore backup (`pg_restore`, fallback `psql`).
5. Run `prisma migrate status` against restored DB.
6. Run integrity assertion (`Organization` row count threshold).
7. Emit report artifacts and fail non-zero on any failed gate.

## Scheduled workflow

- `.github/workflows/backup-verify.yml`
- Triggered daily and by manual dispatch.

## RPO/RTO notes

- RPO is captured as backup object age (`ageSeconds`).
- RTO is captured as restore drill elapsed time (`rtoMs`).

## Manual fallback steps

1. Fetch latest backup from S3 to local secure path.
2. Start isolated Postgres instance (never production target).
3. Restore backup with `pg_restore` or `psql`.
4. Run `pnpm --filter @studioos/apps-api_nestjs prisma:migrate:status` with restored `DATABASE_URL`.
5. Validate key table counts and relation spot-checks.
6. If restore fails, trigger incident response and investigate backup pipeline immediately.
