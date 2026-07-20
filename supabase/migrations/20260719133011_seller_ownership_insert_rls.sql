-- Phase 04 / T01 — restore ERD §3-specced permissive ownership INSERT policies.
-- Completes planned work (the open-issue-#14 / REG-29 class); adds no access
-- surface beyond what BETK_ERD.md §3 already speccs.
--
-- REG-10: seller_profiles had sp_select (SELECT) + sp_update (UPDATE) + the
--   RESTRICTIVE seller_profiles_phone_gate (INSERT), but NO permissive INSERT,
--   so INSERT was impossible for everyone. This permissive INSERT COMBINES with
--   the RESTRICTIVE phone gate (both must hold): a phone-verified user can create
--   their OWN row; a phone-NULL user is still blocked by the gate.
-- REG-31: stores had stores_public (SELECT) + stores_manage (UPDATE only) but NO
--   INSERT policy, despite ERD §3 speccing stores INSERT = own. 3rd instance of
--   the REG-29 / #14 class (ERD-specced policy omitted from the Phase-01 SQL).
CREATE POLICY sp_insert ON betk.seller_profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY stores_insert ON betk.stores FOR INSERT
  WITH CHECK (seller_id = auth.uid());
