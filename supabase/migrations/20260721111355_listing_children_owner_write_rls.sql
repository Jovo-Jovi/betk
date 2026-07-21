-- REG-34 — listing_images / listing_tags owner-write RLS policies.
-- ERD BETK_ERD.md §3 row 48:
--   | listing_images / listing_tags | follows listing | own store | own store | own store | via listing |
-- SELECT basis = "follows listing" (public policies listing_images_public /
-- listing_tags_public, added by T01-FIX 20260630232657 + amended by REG-25-FIX
-- 20260718230302) are LEFT UNTOUCHED. INSERT/UPDATE/DELETE basis = "own store"
-- was SPECCED but the CREATE POLICY statements were omitted from the Phase-01
-- SQL contract (children carried ONLY their public SELECT policy -> owner
-- write default-denied). This is the 4th instance of the open-issue-#14 /
-- REG-29 / REG-31 class (ERD §3-specced policy absent from the shipped SQL).
--
-- Shape mirrors the parent betk.listings_seller (FOR ALL USING (store_id =
-- my_store_id() OR is_admin())), scoped to the child via the owning listing.
-- FOR ALL: the USING clause governs SELECT/UPDATE/DELETE row visibility AND
-- serves as the implicit WITH CHECK for INSERT/UPDATE (same pattern as
-- listings_seller / sp_insert). It OR-combines (PERMISSIVE) with the existing
-- public SELECT policy, reconstructing row 48's "follows listing" SELECT
-- (own-store any-status via this policy OR public active/sold_out via the
-- public policy). References only the SECURITY DEFINER helpers my_store_id()/
-- is_admin() (no bare auth.*), so no new auth_rls_initplan finding is added.
--
-- restock_alerts is INTENTIONALLY NOT TOUCHED (Phase-12/notifications-owned;
-- RLS-enabled zero-policy by design per the ERD §3 owning-phase map).

CREATE POLICY listing_images_seller ON betk.listing_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_images.listing_id
        AND (l.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

CREATE POLICY listing_tags_seller ON betk.listing_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_tags.listing_id
        AND (l.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
