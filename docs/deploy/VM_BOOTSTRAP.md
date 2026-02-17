# VM Bootstrap (Ubuntu)

## Run Order
1. `sudo bash scripts/deploy/vm/bootstrap.sh <deploy-user>`
2. `sudo bash scripts/deploy/vm/hardening.sh`

## What Bootstrap Does
- Installs base packages (`curl`, `git`, `ufw`, `fail2ban`, `ca-certificates`, `gnupg`, `lsb-release`)
- Installs Docker Engine + Docker Compose plugin from official Docker apt repo
- Ensures deploy user exists and is in docker group
- Creates:
  - `/opt/studio-platform`
  - `/opt/studio-platform/backups`
  - `/opt/studio-platform/logs`
  - `/opt/studio-platform/deploy-state`

## Security Baseline
- UFW defaults:
  - deny incoming
  - allow outgoing
- Allowed inbound only:
  - OpenSSH
  - 80/tcp
  - 443/tcp
- Enables and restarts `fail2ban`

## Verification
- `docker --version`
- `docker compose version`
- `ufw status verbose`
