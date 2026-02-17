#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.mpprod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
STATE_DIR="${STATE_DIR:-/opt/studio-platform/deploy-state}"
PREVIOUS_SHA_FILE="${STATE_DIR}/previous"

if [[ ! -f "${PREVIOUS_SHA_FILE}" ]]; then
  echo "No previous deployment SHA found at ${PREVIOUS_SHA_FILE}" >&2
  exit 1
fi

TARGET_SHA="$(cat "${PREVIOUS_SHA_FILE}")"

cd "${ROOT_DIR}"
git fetch --all --prune
git checkout --detach "${TARGET_SHA}"

"${ROOT_DIR}/scripts/deploy/vm/validate-env.sh"

set -a
source "${COMPOSE_ENV_FILE}"
set +a
export DEPLOY_REF="${TARGET_SHA}"

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" stop api web proxy || true

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" build api web

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres redis api web proxy

"${ROOT_DIR}/scripts/deploy/vm/smoke.sh"

echo "Rollback completed to ${TARGET_SHA}"
