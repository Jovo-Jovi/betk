-- ============================================================
-- 0003_user_seller_store.sql
-- C3 Step 6 steps 007-013: Groups B (buyer_profiles, addresses),
-- C (seller_profiles, seller_documents, seller_strikes), D (stores, store_follows).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- B1. buyer_profiles
-- Extended buyer-specific data
-- ============================================================
CREATE TABLE betk.buyer_profiles (
  id                  UUID          PRIMARY KEY REFERENCES betk.users(id) ON DELETE CASCADE,
  full_name           VARCHAR(100)  NOT NULL,
  governorate         VARCHAR(50)   NOT NULL,
  city                VARCHAR(100),
  interests           JSONB         NOT NULL DEFAULT '[]',
  notification_prefs  JSONB         NOT NULL DEFAULT '{"push":true,"sms":true,"whatsapp":true,"email":false}'
);

-- ============================================================
-- B2. addresses
-- Buyer delivery address book
-- ============================================================
CREATE TABLE betk.addresses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        UUID          NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  label           VARCHAR(50),
  governorate     VARCHAR(50)   NOT NULL,
  city            VARCHAR(100)  NOT NULL,
  street_address  TEXT          NOT NULL,
  building_notes  TEXT,
  is_default      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- C1. seller_profiles
-- ============================================================
CREATE TABLE betk.seller_profiles (
  id                      UUID           PRIMARY KEY REFERENCES betk.users(id) ON DELETE CASCADE,
  status                  seller_status  NOT NULL DEFAULT 'pending',
  suspension_ends_at      TIMESTAMPTZ,
  level                   seller_level   NOT NULL DEFAULT 'bronze',
  level_score             SMALLINT       NOT NULL DEFAULT 0
                          CHECK (level_score BETWEEN 0 AND 100),
  is_verified             BOOLEAN        NOT NULL DEFAULT FALSE,
  avg_response_hours      NUMERIC(5,2),
  total_orders_completed  INTEGER        NOT NULL DEFAULT 0,
  total_reviews_count     INTEGER        NOT NULL DEFAULT 0,
  strike_count            SMALLINT       NOT NULL DEFAULT 0,
  approved_at             TIMESTAMPTZ,
  rejected_reason         TEXT,
  submitted_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- C2. seller_documents
-- ============================================================
CREATE TABLE betk.seller_documents (
  id             UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID               NOT NULL REFERENCES betk.seller_profiles(id) ON DELETE CASCADE,
  document_type  doc_type           NOT NULL,
  storage_path   TEXT               NOT NULL,
  uploaded_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  review_status  doc_review_status  NOT NULL DEFAULT 'pending',
  CONSTRAINT uq_seller_doc_type UNIQUE (seller_id, document_type)
);

-- ============================================================
-- C3. seller_strikes
-- ============================================================
CREATE TABLE betk.seller_strikes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID         NOT NULL REFERENCES betk.seller_profiles(id) ON DELETE CASCADE,
  issued_by   UUID         NOT NULL REFERENCES betk.users(id),
  reason      TEXT         NOT NULL,
  strike_type strike_type  NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- D1. stores
-- ============================================================
CREATE TABLE betk.stores (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID          NOT NULL REFERENCES betk.seller_profiles(id) ON DELETE CASCADE,
  name_ar           VARCHAR(100)  NOT NULL,
  name_en           VARCHAR(100),
  slug              VARCHAR(50)   NOT NULL,
  slug_changed_at   TIMESTAMPTZ,
  bio_ar            VARCHAR(200),
  avatar_url        TEXT,
  cover_url         TEXT,
  category_primary  VARCHAR(50)   NOT NULL,
  category_secondary VARCHAR(50),
  governorate       VARCHAR(50)   NOT NULL,
  city              VARCHAR(100),
  payment_methods   JSONB         NOT NULL DEFAULT '{}',
  delivery_options  JSONB         NOT NULL DEFAULT '{}',
  return_policy     TEXT,
  min_order_egp     NUMERIC(10,2),
  status            store_status  NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_stores_seller   UNIQUE (seller_id),
  CONSTRAINT uq_stores_slug     UNIQUE (slug),
  CONSTRAINT chk_store_slug_fmt CHECK (slug ~ '^[a-z0-9-]+$')
);

-- ============================================================
-- D2. store_follows
-- ============================================================
CREATE TABLE betk.store_follows (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  store_id    UUID         NOT NULL REFERENCES betk.stores(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_store_follow UNIQUE (buyer_id, store_id)
);
