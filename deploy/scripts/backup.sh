#!/usr/bin/env bash
# Dump Postgres to deploy/backups/ (host path). Safe for cron.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
source .env
set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
OUT_FILE="${OUT_DIR}/moid-pg-${STAMP}.sql.gz"

echo "[backup] writing ${OUT_FILE}"
docker compose exec -T db \
  pg_dump -U postgres -d postgres --no-owner --no-acl \
  | gzip -c >"$OUT_FILE"

# Keep last N dumps (default 14)
KEEP="${BACKUP_KEEP:-14}"
ls -1t "$OUT_DIR"/moid-pg-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[backup] OK ($(du -h "$OUT_FILE" | awk '{print $1}'))"
echo "$OUT_FILE"
