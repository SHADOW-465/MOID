-- Named plant users.
--
-- Auth previously had three shared role passwords (gm / owner / operator). They
-- authenticated a ROLE, not a person, so the append-only ledger could never say
-- who entered a value — three operators shared one credential. For a medical
-- device QMS that is the defect that matters: an electronic record has to be
-- attributable to an individual, and a shared login also means you cannot
-- revoke one leaver without re-issuing the password to everybody else.
--
-- No email, no external IdP. A GM creates accounts, same as on-prem MES/LIMS.
--
-- Passwords are scrypt hashes; the plaintext never reaches this table. `role`
-- reuses the existing PersonaId values so the capability model in persona.ts
-- and lib/auth/guard.ts is unchanged — this only makes the subject of a session
-- a person instead of a job title.
--
-- An empty table means "no named users yet", and the preset role logins keep
-- working so a fresh deploy is never locked out. See lib/auth/users.ts.

CREATE TABLE IF NOT EXISTS plant_users (
  company_id    text        NOT NULL,
  username      text        NOT NULL,
  display_name  text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('gm','owner','operator')),
  password_hash text        NOT NULL,
  active        boolean     NOT NULL DEFAULT true,
  created_by    text        NOT NULL DEFAULT 'system',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, username)
);

CREATE INDEX IF NOT EXISTS plant_users_active ON plant_users (company_id, active);

ALTER TABLE plant_users ENABLE ROW LEVEL SECURITY;

-- Service role only: this table holds password hashes, so unlike the catalog
-- tables it is never readable by anon/authenticated PostgREST roles.
DROP POLICY IF EXISTS plant_users_service_role_all ON plant_users;
CREATE POLICY plant_users_service_role_all ON plant_users
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.plant_users TO service_role;
REVOKE ALL ON TABLE public.plant_users FROM anon, authenticated;
