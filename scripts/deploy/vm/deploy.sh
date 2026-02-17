#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <git-sha-or-ref>" >&2
  exit 1
fi

TARGET_REF="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/compose/docker-compose.mpprod.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
STATE_DIR="${STATE_DIR:-/opt/studio-platform/deploy-state}"
CURRENT_SHA_FILE="${STATE_DIR}/current"
PREVIOUS_SHA_FILE="${STATE_DIR}/previous"
ARTIFACT_DIR="${ROOT_DIR}/artifacts/deploy"
REPORT_JSON="${ARTIFACT_DIR}/vm-deploy-report.json"
REPORT_MD="${ARTIFACT_DIR}/vm-deploy-report.md"

env_status="FAIL"
migration_status="FAIL"
smoke_status="FAIL"
backup_status="NOT_RUN"
image_tags="[]"

mkdir -p "${ARTIFACT_DIR}"

write_report() {
  local verdict="NOT READY"
  if [[ "${env_status}" == "PASS" && "${migration_status}" == "PASS" && "${smoke_status}" == "PASS" ]]; then
    verdict="DEPLOY READY"
  fi

  cat > "${REPORT_JSON}" <<JSON
{
  "commitSha": "${RESOLVED_SHA:-unknown}",
  "imageTags": ${image_tags},
  "envValidation": "${env_status}",
  "migrationStatus": "${migration_status}",
  "smokeStatus": "${smoke_status}",
  "backupStatus": "${backup_status}",
  "verdict": "${verdict}"
}
JSON

  cat > "${REPORT_MD}" <<MD
# VM Deploy Report

- Commit SHA: \`${RESOLVED_SHA:-unknown}\`
- Image tags: ${image_tags}
- Env validation: **${env_status}**
- Migration status: **${migration_status}**
- Smoke status: **${smoke_status}**
- Backup status: **${backup_status}**

## Final Verdict
**${verdict}**
MD
}

trap write_report EXIT

if [[ ! -f "${COMPOSE_ENV_FILE}" ]]; then
  echo "Missing compose env file: ${COMPOSE_ENV_FILE}" >&2
  exit 1
fi

mkdir -p "${STATE_DIR}"

cd "${ROOT_DIR}"

git fetch --all --prune
git rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1
RESOLVED_SHA="$(git rev-parse "${TARGET_REF}^{commit}")"
git checkout --detach "${RESOLVED_SHA}"

"${ROOT_DIR}/scripts/deploy/vm/validate-env.sh"
env_status="PASS"

set -a
source "${COMPOSE_ENV_FILE}"
set +a
export DEPLOY_REF="${RESOLVED_SHA}"
image_tags="[\"studio-platform/api:${DEPLOY_REF}\",\"studio-platform/web:${DEPLOY_REF}\"]"

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" build api web

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres redis

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" run --rm api pnpm --filter @studioos/apps-api_nestjs prisma:migrate:status

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" run --rm api pnpm exec prisma migrate deploy --schema apps/api_nestjs/prisma/schema.prisma

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" run --rm api pnpm --filter @studioos/apps-api_nestjs prisma:seed
migration_status="PASS"

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" up -d api web proxy

docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" ps

"${ROOT_DIR}/scripts/deploy/vm/smoke.sh"
smoke_status="PASS"

if [[ -f "${CURRENT_SHA_FILE}" ]]; then
  cp "${CURRENT_SHA_FILE}" "${PREVIOUS_SHA_FILE}"
fi
printf '%s\n' "${RESOLVED_SHA}" > "${CURRENT_SHA_FILE}"

echo "Deploy complete at SHA ${RESOLVED_SHA}"
