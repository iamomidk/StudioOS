#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.mpprod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/studio-platform/backups}"

mkdir -p "${BACKUP_DIR}"

set -a
source "${COMPOSE_ENV_FILE}"
set +a

timestamp="$(date +%Y%m%d-%H%M%S)"
out_file="${BACKUP_DIR}/${timestamp}.sql.gz"

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" | gzip -c > "${out_file}"

if [[ ! -s "${out_file}" ]]; then
  echo "Backup file is empty: ${out_file}" >&2
  exit 1
fi

echo "Backup created: ${out_file}"
