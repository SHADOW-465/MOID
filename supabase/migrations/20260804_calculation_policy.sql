-- Calculation policy: the conventions behind every number (how the headline
-- rejection % is composed, where "checked" is measured, cost basis, targets).
--
-- Append-only: one row per change, latest version wins. Reverting is saving the
-- old values again, so history stays complete and any past report can be
-- reproduced under the policy that produced it.
--
-- version = 0 is reserved for the plant restore-point ("Set as plant default").
-- Live history and current() only use version > 0. Upsert on (company_id, 0)
-- overwrites the baseline without appending a history entry.
--
-- No backfill. An empty table means "shipped defaults" (see core/policy/policy.ts
-- DEFAULT_POLICY), which is exactly how the app already behaves.

CREATE TABLE IF NOT EXISTS calculation_policy (
  company_id  text        NOT NULL,
  version     int         NOT NULL,
  policy      jsonb       NOT NULL,
  changed_by  text        NOT NULL DEFAULT 'unknown',
  changed_at  timestamptz NOT NULL DEFAULT now(),
  note        text,
  PRIMARY KEY (company_id, version)
);

CREATE INDEX IF NOT EXISTS calculation_policy_latest
  ON calculation_policy (company_id, version DESC);

ALTER TABLE calculation_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calculation_policy_service_role_all ON calculation_policy;
CREATE POLICY calculation_policy_service_role_all ON calculation_policy
  FOR ALL USING (true) WITH CHECK (true);
