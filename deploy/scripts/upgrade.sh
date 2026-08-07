#!/usr/bin/env bash
# Upgrade plant appliance: rebuild app image, re-apply new migrations, restart.
# Does not drop data. Take a backup first: ./scripts/backup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing deploy/.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "[upgrade] recommended: ./scripts/backup.sh before continuing"
echo "[upgrade] building new app image..."
docker compose build app

echo "[upgrade] restarting app + gateway..."
docker compose up -d db rest app gateway

echo "[upgrade] applying any new migrations..."
docker compose --profile tools run --rm \
  -e DB_AUTHENTICATOR_PASSWORD="${DB_AUTHENTICATOR_PASSWORD:-changeme_authenticator}" \
  migrate

docker compose restart rest app gateway

echo "[upgrade] done. Smoke-check: curl -sf http://127.0.0.1:${MOID_HTTP_PORT:-80}/healthz"
