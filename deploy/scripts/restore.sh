#!/usr/bin/env bash
# Restore a gzipped pg_dump into the plant DB. DESTRUCTIVE to current data.
# Usage: ./scripts/restore.sh deploy/backups/moid-pg-YYYYMMDDTHHMMSSZ.sql.gz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage: $0 <path-to-moid-pg-*.sql.gz>" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo "[restore] WARNING: this replaces data in the running Postgres volume."
echo "[restore] dump: $DUMP"
read -r -p "Type RESTORE to continue: " confirm
if [[ "$confirm" != "RESTORE" ]]; then
  echo "aborted"
  exit 1
fi

echo "[restore] stopping app/rest (keep db up)..."
docker compose stop app rest gateway || true

echo "[restore] dropping & recreating public schema objects via full restore..."
# Terminate other connections
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='postgres' AND pid <> pg_backend_pid();" \
  || true

gunzip -c "$DUMP" | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1

echo "[restore] starting services..."
docker compose up -d db rest app gateway
docker compose restart rest

echo "[restore] done. Verify UI and a known batch/KPI."
