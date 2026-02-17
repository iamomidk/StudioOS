#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.mpprod.yml}"

if [[ ! -f "${COMPOSE_ENV_FILE}" ]]; then
  echo "Missing compose env file: ${COMPOSE_ENV_FILE}" >&2
  exit 1
fi

set -a
source "${COMPOSE_ENV_FILE}"
set +a

if [[ -n "${SMOKE_ORG_ID_OVERRIDE:-}" ]]; then
  export SMOKE_ORG_ID="${SMOKE_ORG_ID_OVERRIDE}"
fi

export SMOKE_BASE_URL_API="${SMOKE_BASE_URL_API:-${PUBLIC_API_URL}}"
export SMOKE_BASE_URL_WEB="${SMOKE_BASE_URL_WEB:-${PUBLIC_WEB_URL}}"
export SMOKE_TIMEOUT_MS="${SMOKE_TIMEOUT_MS:-$(( ${SMOKE_TIMEOUT_SECONDS:-300} * 1000 ))}"

cd "${ROOT_DIR}"

mkdir -p /opt/studio-platform/logs

api_container_id="$(
  docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" ps -q api
)"
if [[ -z "${api_container_id}" ]]; then
  echo "API container is not running. Start the stack before smoke checks." >&2
  exit 1
fi

set +e
docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" exec -T \
  -e SMOKE_BASE_URL_API="${SMOKE_BASE_URL_API}" \
  -e SMOKE_BASE_URL_WEB="${SMOKE_BASE_URL_WEB}" \
  -e SMOKE_USER_EMAIL="${SMOKE_USER_EMAIL}" \
  -e SMOKE_USER_PASSWORD="${SMOKE_USER_PASSWORD}" \
  -e SMOKE_ORG_ID="${SMOKE_ORG_ID}" \
  -e SMOKE_CHECK_TOKEN="${SMOKE_CHECK_TOKEN}" \
  -e SMOKE_TIMEOUT_MS="${SMOKE_TIMEOUT_MS}" \
  api node scripts/smoke-test.mjs
status=$?
set -e

docker cp "${api_container_id}:/workspace/artifacts/smoke/summary.json" /opt/studio-platform/logs/smoke-latest.json >/dev/null 2>&1 || true

if [[ ${status} -ne 0 ]]; then
  echo "Smoke checks failed." >&2
  exit ${status}
fi

echo "Smoke checks passed."
