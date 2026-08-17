-- Shop-floor sections (Production Dipping / Secondary / Assembly, plus any
-- the plant adds on Data Schema). Labels live here so renaming a section
-- does not rewrite every stage row.
ALTER TABLE company_catalog
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb;
