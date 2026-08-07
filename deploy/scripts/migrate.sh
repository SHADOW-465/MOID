#!/bin/sh
# Apply MOID SQL migrations in lexicographic filename order (Supabase CLI style).
# Runs inside the compose `migrate` service (postgres client image).
set -eu

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

echo "[migrate] waiting for ${DB_HOST}..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<SQL
CREATE TABLE IF NOT EXISTS public.moid_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# Keep authenticator password in sync with compose env (init only runs on empty volume).
AUTH_PASS="${DB_AUTHENTICATOR_PASSWORD:-changeme_authenticator}"
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  -c "ALTER ROLE authenticator WITH PASSWORD '${AUTH_PASS}';" || true

# Ensure grants exist even on re-runs / upgraded volumes.
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'changeme_authenticator';
  END IF;
END
$$;
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
SQL

applied=0
skipped=0
for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  base=$(basename "$f")
  already=$(psql -tA -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT 1 FROM public.moid_schema_migrations WHERE filename = '${base}' LIMIT 1;" || true)
  if [ "$already" = "1" ]; then
    echo "[migrate] skip ${base}"
    skipped=$((skipped + 1))
    continue
  fi
  echo "[migrate] apply ${base}"
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$f"
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -c "INSERT INTO public.moid_schema_migrations (filename) VALUES ('${base}');"
  applied=$((applied + 1))
done

echo "[migrate] done (applied=${applied}, skipped=${skipped})"
