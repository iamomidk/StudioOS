# Backup and Rollback

## Backup
Run:
- `bash scripts/deploy/vm/backup-db.sh`

Output:
- `/opt/studio-platform/backups/YYYYmmdd-HHMMSS.sql.gz`

Suggested retention (cron):
```cron
0 2 * * * /bin/bash /opt/studio-platform/scripts/deploy/vm/backup-db.sh && find /opt/studio-platform/backups -type f -name '*.sql.gz' -mtime +14 -delete
```

## Restore
Run (explicit confirmation required):
- `bash scripts/deploy/vm/restore-db.sh /opt/studio-platform/backups/<file>.sql.gz --yes-i-understand`

Post-restore checks:
- migration status command in restore script
- API health + smoke checks

## Rollback
Run:
- `bash scripts/deploy/vm/rollback.sh`

Rollback uses `/opt/studio-platform/deploy-state/previous` as target SHA and performs:
1. checkout previous SHA
2. build `api` + `web`
3. restart MVP services
4. rerun smoke checks

Database rollback is manual via restore script if schema/data incompatibility appears.
