-- ============================================================
-- 20260718230302_listings_public_sold_out_visibility.sql
-- REG-25 — sold_out public visibility (FR-PUB-4 / R-N06).
--
-- The public listing-detail page (/listing/[id]) must keep a genuinely
-- sold_out-status listing PUBLICLY VISIBLE with a restock CTA (FR-PUB-4:
-- "sold_out -> restock CTA (R-N06)"; BETK_UI_SPEC.md 108-110). The live
-- decrement_stock_on_confirm trigger (R2) flips listings.status to 'sold_out'
-- at stock_qty=0, at which point the existing listings_public predicate
-- (status='active') 404s the detail page — the REG-25 conflict.
--
-- BROWSE grids stay active-only (BETK_UI_SPEC.md homepage L73 / search L85 /
-- category L97 / storefront L121 all pin status='active'); that exclusion is
-- enforced by the query layer's explicit .eq(status,'active'), NOT by RLS.
-- Widening RLS to include sold_out ONLY makes the detail read (getListingById,
-- which has no status filter of its own) resolve — it does not add sold_out to
-- any browse surface.
--
-- AMENDS 3 live predicates (each REPLACES status='active' with
-- status IN ('active','sold_out')); draft/paused/removed/soft-deleted stay
-- hidden. The two catalog child policies (listing_images_public,
-- listing_tags_public) gate on the parent listing's status, so without this a
-- sold_out detail page would render with NO images/tags — they are amended
-- verbatim-consistent with the parent. review_photos_public (via review),
-- collection_listings_public (via collection), rating_aggregates_public
-- (public) do NOT reference listing status and are intentionally untouched.
--
-- Source intent: docs/01-product/BETK_PRD.md FR-PUB-4/R-N06/R-L06/R-L07;
--                docs/00-design/BETK_UI_SPEC.md; docs/03-database/BETK_ERD.md 47-48.
-- ============================================================
SET search_path TO betk, public;

-- PARENT: expose active + sold_out to the public (own store / admin unchanged).
ALTER POLICY listings_public ON betk.listings
  USING (
    (status IN ('active', 'sold_out') AND deleted_at IS NULL)
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );

-- CHILD: images follow the parent's specced visible set (else a sold_out
-- detail page renders with no gallery).
ALTER POLICY listing_images_public ON betk.listing_images
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_images.listing_id
        AND l.status IN ('active', 'sold_out')
        AND l.deleted_at IS NULL
    )
  );

-- CHILD: tags follow the parent's specced visible set (else a sold_out detail
-- page renders with no tag chips).
ALTER POLICY listing_tags_public ON betk.listing_tags
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_tags.listing_id
        AND l.status IN ('active', 'sold_out')
        AND l.deleted_at IS NULL
    )
  );
