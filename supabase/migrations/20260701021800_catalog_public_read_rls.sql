-- ============================================================
-- 20260701021800_catalog_public_read_rls.sql
-- Phase 03 / T01-FIX — open-issue #14.
--
-- Completes the Phase-01 public-read RLS that was SPECCED in the ERD §3 RLS
-- matrix (BETK_ERD.md) but whose CREATE POLICY statements were omitted from the
-- authoritative SQL contract (BETK_DATABASE_SCHEMA.sql) — these 5 catalog child
-- tables were left RLS-ENABLED with ZERO policies, so every public/anon read
-- (even an embedded parent select) returned zero rows. Phase 01 T08 finding F1
-- ("~21 RLS-enabled-no-policy tables ... remaining policies arrive in later
-- phases") anticipated this; T01 (Phase 03) pinned the exact 5 that gate
-- FR-PUB-1/4/5 (hero/gallery images, tag chips, rating stars, homepage
-- collection strips, review photos).
--
-- ERD §3 specced visibility (the predicates below mirror it exactly):
--   listing_images / listing_tags  → "via listing"     (follows the listing)
--   review_photos                  → "via review"      (follows the review)
--   rating_aggregates              → "read-public"     (public aggregate metric)
--   collection_listings            → "via collection"  (follows the collection)
--
-- ADDITIVE ONLY: five new PERMISSIVE FOR SELECT policies. No table/column/grant
-- changes, no service-role, no touching existing policies. Each parent-following
-- predicate is scoped to PUBLICLY-VISIBLE parent rows only (no draft/soft-deleted
-- listing, hidden review, or non-live collection leakage). The EXISTS subqueries
-- run under the caller's RLS on the parent table; they resolve for the anon role
-- precisely because listings_public / reviews_public / collections_public are
-- already live (verified). Owner/admin reads of these child rows belong to their
-- owning phases (seller listing mgmt, admin moderation) and will be ADDITIVE
-- permissive policies that OR-combine with these — these public policies are
-- intentionally minimal.
--
-- Source intent: docs/03-database/BETK_ERD.md §3 (RLS matrix);
--                docs/03-database/BETK_DATABASE_SCHEMA.sql (parent policies).
-- ============================================================
SET search_path TO betk, public;

-- LISTING_IMAGES: public only for an active, not-soft-deleted listing (ERD "via listing").
CREATE POLICY listing_images_public ON betk.listing_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_images.listing_id
        AND l.status = 'active'
        AND l.deleted_at IS NULL
    )
  );

-- LISTING_TAGS: same active + not-deleted listing scope (ERD "via listing").
CREATE POLICY listing_tags_public ON betk.listing_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_tags.listing_id
        AND l.status = 'active'
        AND l.deleted_at IS NULL
    )
  );

-- REVIEW_PHOTOS: public only for a visible review (ERD "via review").
CREATE POLICY review_photos_public ON betk.review_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.reviews r
      WHERE r.id = review_photos.review_id
        AND r.is_visible = TRUE
    )
  );

-- COLLECTION_LISTINGS: public only for a live collection (ERD "via collection").
CREATE POLICY collection_listings_public ON betk.collection_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.collections c
      WHERE c.id = collection_listings.collection_id
        AND c.status = 'live'
    )
  );

-- RATING_AGGREGATES: pre-computed per-store rating summary (ERD "read-public").
-- Holds ONLY aggregate counts keyed by store_id (average_rating, total_reviews,
-- rating_1..rating_5, last_recalculated_at) — NO PII, no row-level user data — so
-- USING (TRUE) is the correct, spec-aligned scope (matches ERD §3 "public").
CREATE POLICY rating_aggregates_public ON betk.rating_aggregates FOR SELECT
  USING (TRUE);
