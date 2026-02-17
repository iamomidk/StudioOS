#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <backup-file.sql.gz> --yes-i-understand" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM_FLAG="$2"

if [[ "${CONFIRM_FLAG}" != "--yes-i-understand" ]]; then
  echo "Restore refused. Pass --yes-i-understand to continue." >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.mpprod.yml}"

set -a
source "${COMPOSE_ENV_FILE}"
set +a

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres

gzip -dc "${BACKUP_FILE}" | docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" run --rm api pnpm --filter @studioos/apps-api_nestjs prisma:migrate:status

echo "Restore completed from ${BACKUP_FILE}"
