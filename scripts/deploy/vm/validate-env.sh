#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="${ENV_DIR:-/opt/studio-platform/deploy/env}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ENV_DIR}/.env.compose}"
API_ENV_FILE="${API_ENV_FILE:-${ENV_DIR}/.env.api}"
WEB_ENV_FILE="${WEB_ENV_FILE:-${ENV_DIR}/.env.web}"

if [[ ! -f "${COMPOSE_ENV_FILE}" ]]; then
  echo "Missing compose env file: ${COMPOSE_ENV_FILE}" >&2
  exit 1
fi

set -a
source "${COMPOSE_ENV_FILE}"
[[ -f "${API_ENV_FILE}" ]] && source "${API_ENV_FILE}"
[[ -f "${WEB_ENV_FILE}" ]] && source "${WEB_ENV_FILE}"
set +a

missing=()
required=(
  APP_DOMAIN
  API_DOMAIN
  PUBLIC_WEB_URL
  PUBLIC_API_URL
  NEXT_PUBLIC_API_BASE_URL
  INTERNAL_API_BASE_URL
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  DATABASE_URL
  REDIS_URL
  JWT_ACCESS_TOKEN_SECRET
  JWT_REFRESH_TOKEN_SECRET
  CORS_ALLOWED_ORIGINS
  SMOKE_USER_EMAIL
  SMOKE_USER_PASSWORD
  SMOKE_ORG_ID
  SMOKE_OPS_ENABLED
  SMOKE_CHECK_TOKEN
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("${key}")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing required env keys:" >&2
  for key in "${missing[@]}"; do
    echo " - ${key}" >&2
  done
  exit 1
fi

require_exact() {
  local key="$1"
  local expected="$2"
  local actual="${!key:-}"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "Invalid ${key}: expected '${expected}', got '${actual:-<empty>}'" >&2
    exit 1
  fi
}

require_exact MVP_MODE true
require_exact ENABLE_ADVANCED false
require_exact FEATURE_MARKETPLACE_ENABLED false
require_exact FEATURE_DISPUTES_ENABLED false
require_exact FEATURE_PUBLIC_LAUNCH_ENABLED false
require_exact FEATURE_PRICING_EXPERIMENTS_ENABLED false
require_exact FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED false
require_exact PUBLIC_MODULES_GLOBAL_KILL_SWITCH true
require_exact SMOKE_OPS_ENABLED true

if [[ ! "${DATABASE_URL}" =~ ^postgres(ql)?:// ]]; then
  echo "DATABASE_URL must start with postgres:// or postgresql://" >&2
  exit 1
fi

if [[ ! "${REDIS_URL}" =~ ^redis:// ]]; then
  echo "REDIS_URL must start with redis://" >&2
  exit 1
fi

if [[ ! "${PUBLIC_WEB_URL}" =~ ^https?:// ]]; then
  echo "PUBLIC_WEB_URL must start with http:// or https://" >&2
  exit 1
fi

if [[ ! "${PUBLIC_API_URL}" =~ ^https?:// ]]; then
  echo "PUBLIC_API_URL must start with http:// or https://" >&2
  exit 1
fi

if [[ "${NEXT_PUBLIC_API_BASE_URL}" != "${PUBLIC_API_URL}" ]]; then
  echo "NEXT_PUBLIC_API_BASE_URL must match PUBLIC_API_URL for MVP deployment." >&2
  exit 1
fi

echo "Environment validation passed."
