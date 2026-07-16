-- ============================================================
-- 20260716125122_harden_decrement_stock_fn_execute.sql
-- R2 hardening (follow-up to 20260716124323_decrement_stock_on_confirm.sql).
-- Revoke the default PUBLIC EXECUTE grant on the SECURITY DEFINER function
-- betk.decrement_stock_on_confirm() so it is NOT RPC-exposed to anon/authenticated
-- (clears security-advisor lints 0028 anon_security_definer_function_executable /
-- 0029 authenticated_security_definer_function_executable). The function is only
-- ever invoked by trg_decrement_stock_on_confirm; triggers fire regardless of the
-- firing role's EXECUTE privilege, so stock decrement on order confirmation is
-- unaffected. Source parity: docs/03-database/BETK_DATABASE_SCHEMA.sql.
-- ============================================================
SET search_path TO betk, public;

REVOKE EXECUTE ON FUNCTION betk.decrement_stock_on_confirm() FROM PUBLIC, anon, authenticated;
