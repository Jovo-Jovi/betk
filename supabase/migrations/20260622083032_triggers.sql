-- ============================================================
-- 0009_triggers.sql
-- C3 Step 6 step 051: trigger functions + triggers, reproduced verbatim from the
-- source schema (where they appear inline after their tables) and grouped here.
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql.
--
-- NOTE: the source schema defines FOUR triggers (search_vector, review
-- edit_deadline, dispute SLA, rating-aggregate recompute). The "stock decrement
-- on confirm" trigger referenced in BETK_ERD.md §7 / the phase-pack DoD is NOT
-- present in the authoritative source file and is therefore not reproduced here.
-- Flagged for product/DB owner (see SESSION_CONTEXT open issues).
-- ============================================================
SET search_path TO betk, public;

-- ── listings.search_vector (auto-update on insert/update) ─────────────────────
CREATE OR REPLACE FUNCTION betk.update_listing_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('arabic', COALESCE(NEW.title_ar, '')), 'A')
    || setweight(to_tsvector('english', COALESCE(NEW.title_en, '')), 'B')
    || setweight(to_tsvector('english', COALESCE(NEW.description_ar, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listing_search_vector
BEFORE INSERT OR UPDATE ON betk.listings
FOR EACH ROW EXECUTE FUNCTION betk.update_listing_search_vector();

-- ── reviews.edit_deadline (set on insert) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION betk.set_review_edit_deadline()
RETURNS TRIGGER AS $$
BEGIN
  NEW.edit_deadline := NEW.created_at + INTERVAL '48 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_edit_deadline
BEFORE INSERT ON betk.reviews
FOR EACH ROW EXECUTE FUNCTION betk.set_review_edit_deadline();

-- ── disputes.sla_deadline (set on insert) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION betk.set_dispute_sla()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sla_deadline := NEW.created_at + INTERVAL '48 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dispute_sla
BEFORE INSERT ON betk.disputes
FOR EACH ROW EXECUTE FUNCTION betk.set_dispute_sla();

-- ── rating_aggregates recompute (after review insert/update) ──────────────────
CREATE OR REPLACE FUNCTION betk.recalculate_rating_aggregate()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO betk.rating_aggregates (store_id, average_rating, total_reviews,
    rating_5, rating_4, rating_3, rating_2, rating_1, last_recalculated_at)
  SELECT
    NEW.store_id,
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(*),
    COUNT(*) FILTER (WHERE rating = 5),
    COUNT(*) FILTER (WHERE rating = 4),
    COUNT(*) FILTER (WHERE rating = 3),
    COUNT(*) FILTER (WHERE rating = 2),
    COUNT(*) FILTER (WHERE rating = 1),
    NOW()
  FROM betk.reviews
  WHERE store_id = NEW.store_id AND is_visible = TRUE
  ON CONFLICT (store_id) DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    rating_5 = EXCLUDED.rating_5,
    rating_4 = EXCLUDED.rating_4,
    rating_3 = EXCLUDED.rating_3,
    rating_2 = EXCLUDED.rating_2,
    rating_1 = EXCLUDED.rating_1,
    last_recalculated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalculate_rating
AFTER INSERT OR UPDATE ON betk.reviews
FOR EACH ROW EXECUTE FUNCTION betk.recalculate_rating_aggregate();
