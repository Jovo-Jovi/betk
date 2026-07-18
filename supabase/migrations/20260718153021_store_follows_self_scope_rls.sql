-- ============================================================
-- store_follows_self_scope_rls.sql
-- Phase 03 / T06 (REG-29) — restores the self-scope RLS policies SPECCED in
-- the ERD §3 matrix (BETK_ERD.md line 45) but whose CREATE POLICY statements
-- were omitted from the authoritative SQL contract (BETK_DATABASE_SCHEMA.sql):
-- betk.store_follows was left RLS-ENABLED with ZERO policies, so every read/
-- write (incl. the owning buyer's own) was default-denied. Same class + same
-- resolution pattern as open-issue #14 / T01-FIX (catalog_public_read_rls) —
-- second instance (REG-29). Discovered by Phase 03 / T06 when wiring the
-- toggleFollow Server Action + the storefront FollowButton state read.
--
-- ERD §3 line 45 specced visibility (the policies below mirror it EXACTLY):
--   store_follows -> SELECT: self or admin | INSERT: self | UPDATE: - | DELETE: self
--
-- ADDITIVE ONLY: three new PERMISSIVE policies (SELECT / INSERT / DELETE). NO
-- UPDATE policy (ERD pins UPDATE = "-"; a follow row is immutable — you follow
-- or you don't, toggled by insert/delete, never updated). No table/column/grant
-- changes, no service-role, no touching any other table or policy.
--
-- Source intent: docs/03-database/BETK_ERD.md §3 (RLS matrix, line 45).
-- ============================================================
SET search_path TO betk, public;

-- SELECT: the follower sees their own rows; admin sees all (ERD "self or admin").
CREATE POLICY sf_select_self ON betk.store_follows FOR SELECT
  USING (buyer_id = auth.uid() OR betk.is_admin());

-- INSERT: a buyer may only follow AS THEMSELVES (ERD "self").
CREATE POLICY sf_insert_self ON betk.store_follows FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- DELETE: a buyer may only unfollow THEIR OWN follow (ERD "self").
CREATE POLICY sf_delete_self ON betk.store_follows FOR DELETE
  USING (buyer_id = auth.uid());
