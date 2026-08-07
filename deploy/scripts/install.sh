#!/usr/bin/env bash
# First-time plant install: secrets check → build → up → migrate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "No deploy/.env — copy env.example and run ./scripts/gen-secrets.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || "${NEXT_PUBLIC_SUPABASE_URL}" == "http://REPLACE_WITH_PLANT_LAN_IP_OR_HOSTNAME" ]]; then
  echo "Set NEXT_PUBLIC_SUPABASE_URL in deploy/.env to the URL operators will open" >&2
  echo "  (e.g. http://10.0.0.50 or http://moid.plant.local)." >&2
  exit 1
fi

if [[ -z "${JWT_SECRET:-}" || -z "${POSTGRES_PASSWORD:-}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing secrets. Run: ./scripts/gen-secrets.sh" >&2
  exit 1
fi

echo "[install] building app image (public URL=${NEXT_PUBLIC_SUPABASE_URL})..."
docker compose build app

echo "[install] starting db + rest + app + gateway..."
docker compose up -d db rest app gateway

echo "[install] applying migrations..."
docker compose --profile tools run --rm \
  -e DB_AUTHENTICATOR_PASSWORD="${DB_AUTHENTICATOR_PASSWORD:-changeme_authenticator}" \
  migrate

# PostgREST may have started before authenticator password was updated.
docker compose restart rest

echo "[install] waiting for gateway health..."
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${MOID_HTTP_PORT:-80}/healthz" >/dev/null; then
    echo "[install] OK — open ${NEXT_PUBLIC_SUPABASE_URL} on the LAN"
    echo "         UI is served on that host; ledger API is ${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/"
    exit 0
  fi
  sleep 2
done

echo "[install] gateway did not become healthy in time; check: docker compose logs" >&2
exit 1
