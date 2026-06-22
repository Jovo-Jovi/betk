-- ============================================================
-- 0004_catalog.sql
-- C3 Step 6 steps 014-019: Group E (categories, listings, listing_images,
-- listing_tags, wishlists, restock_alerts).
-- NOTE: the listings search_vector trigger is grouped into 0009_triggers.sql.
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- E1. categories
-- ============================================================
CREATE TABLE betk.categories (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID          REFERENCES betk.categories(id) ON DELETE SET NULL,
  name_ar     VARCHAR(100)  NOT NULL,
  name_en     VARCHAR(100),
  slug        VARCHAR(50)   NOT NULL,
  icon_url    TEXT,
  sort_order  SMALLINT      NOT NULL DEFAULT 0,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_categories_slug UNIQUE (slug)
);

-- ============================================================
-- E2. listings
-- ============================================================
CREATE TABLE betk.listings (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID            NOT NULL REFERENCES betk.stores(id) ON DELETE CASCADE,
  category_id           UUID            NOT NULL REFERENCES betk.categories(id),
  subcategory_id        UUID            REFERENCES betk.categories(id),
  type                  listing_type    NOT NULL,
  title_ar              VARCHAR(80)     NOT NULL,
  title_en              VARCHAR(80),
  description_ar        TEXT,
  price                 NUMERIC(10,2)   CHECK (price > 0),
  price_type            price_type      NOT NULL DEFAULT 'fixed',
  stock_qty             INTEGER         CHECK (stock_qty >= 0),
  is_made_to_order      BOOLEAN         NOT NULL DEFAULT FALSE,
  low_stock_threshold   SMALLINT        NOT NULL DEFAULT 3,
  accepts_custom_orders BOOLEAN         NOT NULL DEFAULT FALSE,
  custom_order_notes    TEXT,
  delivery_options      JSONB           NOT NULL DEFAULT '{}',
  status                listing_status  NOT NULL DEFAULT 'draft',
  view_count            INTEGER         NOT NULL DEFAULT 0,
  inquiry_count         INTEGER         NOT NULL DEFAULT 0,
  search_vector         TSVECTOR,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_listing_price CHECK (
    price_type = 'quote_only' OR price IS NOT NULL
  )
);

-- ============================================================
-- E3. listing_images
-- ============================================================
CREATE TABLE betk.listing_images (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  sort_order  SMALLINT     NOT NULL,
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_listing_img_order CHECK (sort_order BETWEEN 0 AND 4)
);

-- ============================================================
-- E4. listing_tags
-- ============================================================
CREATE TABLE betk.listing_tags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  tag         VARCHAR(30)  NOT NULL,
  CONSTRAINT uq_listing_tag UNIQUE (listing_id, tag)
);

-- ============================================================
-- E5. wishlists
-- ============================================================
CREATE TABLE betk.wishlists (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id       UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  listing_id     UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  restock_alert  BOOLEAN      NOT NULL DEFAULT FALSE,
  saved_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wishlist UNIQUE (buyer_id, listing_id)
);

-- ============================================================
-- E6. restock_alerts
-- ============================================================
CREATE TABLE betk.restock_alerts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id     UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  listing_id   UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_restock_alert UNIQUE (buyer_id, listing_id)
);
