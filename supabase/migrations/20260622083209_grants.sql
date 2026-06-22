-- ============================================================
-- 0013_grants.sql
-- C3 Step 6 step 057: role grants for anon, authenticated, service_role.
--
-- NOTE: the authoritative source (docs/03-database/BETK_DATABASE_SCHEMA.sql)
-- documents step 057 as "GRANTS: anon, authenticated, service_role" but does NOT
-- include grant statement bodies. This file therefore contains standard Supabase
-- role-grant plumbing rather than verbatim source SQL. RLS (enabled in 0011 with
-- default-deny) remains the authorization boundary; these grants only let the
-- Data API roles reach the schema — actual row access is still filtered by RLS.
-- service_role bypasses RLS (background jobs / Server Actions re-check ownership).
-- Reminder: betk / betk_analytics must also be added to the API "exposed schemas"
-- (supabase/config.toml [api].schemas or dashboard) for client access.
-- ============================================================

-- Schema usage
GRANT USAGE ON SCHEMA betk            TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA betk_analytics  TO anon, authenticated, service_role;

-- Table privileges (RLS gates the actual rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA betk           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA betk_analytics TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA betk           TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA betk_analytics TO service_role;

-- Sequence privileges (forward-compat; current PKs use gen_random_uuid)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA betk           TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA betk_analytics TO anon, authenticated, service_role;

-- Function execution (helper functions, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA betk TO anon, authenticated, service_role;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA betk
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA betk
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA betk_analytics
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA betk_analytics
  GRANT ALL ON TABLES TO service_role;
