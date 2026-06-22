-- ============================================================
-- 0007_reviews_disputes.sql
-- C3 Step 6 steps 032-037: Group J (reviews, review_photos, rating_aggregates)
-- + Group K (disputes, dispute_evidence, dispute_messages).
-- NOTE: the review edit_deadline, dispute SLA, and rating-recompute triggers are
-- grouped into 0009_triggers.sql.
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- J1. reviews
-- ============================================================
CREATE TABLE betk.reviews (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID         NOT NULL REFERENCES betk.orders(id),
  buyer_id          UUID         NOT NULL REFERENCES betk.users(id),
  store_id          UUID         NOT NULL REFERENCES betk.stores(id),
  rating            SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body              TEXT,
  seller_reply      TEXT,
  seller_replied_at TIMESTAMPTZ,
  is_visible        BOOLEAN      NOT NULL DEFAULT TRUE,
  edit_deadline     TIMESTAMPTZ  NOT NULL,
  admin_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_review_per_order UNIQUE (order_id)
);

-- ============================================================
-- J2. review_photos
-- ============================================================
CREATE TABLE betk.review_photos (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID         NOT NULL REFERENCES betk.reviews(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  sort_order  SMALLINT     NOT NULL CHECK (sort_order BETWEEN 0 AND 2),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- J3. rating_aggregates
-- Pre-computed per-store rating summary
-- ============================================================
CREATE TABLE betk.rating_aggregates (
  store_id             UUID          PRIMARY KEY REFERENCES betk.stores(id) ON DELETE CASCADE,
  average_rating       NUMERIC(3,2)  NOT NULL DEFAULT 0,
  total_reviews        INTEGER       NOT NULL DEFAULT 0,
  rating_5             INTEGER       NOT NULL DEFAULT 0,
  rating_4             INTEGER       NOT NULL DEFAULT 0,
  rating_3             INTEGER       NOT NULL DEFAULT 0,
  rating_2             INTEGER       NOT NULL DEFAULT 0,
  rating_1             INTEGER       NOT NULL DEFAULT 0,
  last_recalculated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- K1. disputes
-- ============================================================
CREATE TABLE betk.disputes (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID               NOT NULL REFERENCES betk.orders(id),
  buyer_id         UUID               NOT NULL REFERENCES betk.users(id),
  store_id         UUID               NOT NULL REFERENCES betk.stores(id),
  reason           dispute_reason     NOT NULL,
  description      TEXT,
  status           dispute_status     NOT NULL DEFAULT 'submitted',
  resolution       dispute_resolution,
  resolution_notes TEXT,
  assigned_to      UUID               REFERENCES betk.users(id),
  sla_deadline     TIMESTAMPTZ        NOT NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dispute_per_order UNIQUE (order_id)
);

-- ============================================================
-- K2. dispute_evidence
-- ============================================================
CREATE TABLE betk.dispute_evidence (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID         NOT NULL REFERENCES betk.disputes(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  description VARCHAR(300),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- K3. dispute_messages
-- Isolated admin-buyer-seller communication
-- ============================================================
CREATE TABLE betk.dispute_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID         NOT NULL REFERENCES betk.disputes(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES betk.users(id),
  sender_type sender_type  NOT NULL,
  body        TEXT         NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
