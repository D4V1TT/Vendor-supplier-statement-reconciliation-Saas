-- ============================================================================
-- Migration 0002: Enable Row-Level Security on all tenant-scoped tables.
--
-- HOW IT WORKS:
--   1. The FastAPI app connects as the `app_user` role.
--   2. Before each query, the app sets:  SET LOCAL app.current_company_id = '<uuid>';
--   3. The RLS policy below only allows rows whose company_id matches that setting.
--   4. Even if there is a bug in the application layer, the DB will refuse
--      cross-tenant data access at the storage engine level.
-- ============================================================================

-- Create the low-privilege application role (run as superuser once)
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
--     CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME';
--   END IF;
-- END $$;
-- GRANT CONNECT ON DATABASE vendorrecon TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ── Enable RLS ────────────────────────────────────────────────────────────────
ALTER TABLE uploaded_statements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_exports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_jobs   ENABLE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────
-- USING clause: applies to SELECT, UPDATE, DELETE
-- WITH CHECK:   applies to INSERT, UPDATE

CREATE POLICY company_isolation ON uploaded_statements
    USING       (company_id = current_setting('app.current_company_id')::uuid)
    WITH CHECK  (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON ledger_exports
    USING       (company_id = current_setting('app.current_company_id')::uuid)
    WITH CHECK  (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON reconciliation_jobs
    USING       (company_id = current_setting('app.current_company_id')::uuid)
    WITH CHECK  (company_id = current_setting('app.current_company_id')::uuid);
