-- ============================================================
-- 0008_boosts_admin_analytics.sql
-- C3 Step 6 steps 038-050: Group L (boost_packages + seed, boosts), Group M
-- (notifications, collections, collection_listings, flagged_content,
-- moderation_logs, whatsapp_templates, admin_settings + seed), and the two
-- betk_analytics tables (seller_snapshots, platform_snapshots).
-- Includes the inline partial-unique guard on active boosts and the append-only
-- RULES on moderation_logs (kept where they appear in the source).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- L1. boost_packages
-- ============================================================
CREATE TABLE betk.boost_packages (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50)    NOT NULL,
  duration_hours SMALLINT       NOT NULL CHECK (duration_hours > 0),
  price_egp      NUMERIC(10,2)  NOT NULL CHECK (price_egp > 0),
  is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order     SMALLINT       NOT NULL DEFAULT 0
);

-- Seed default packages
INSERT INTO betk.boost_packages (name, duration_hours, price_egp, sort_order) VALUES
  ('24-Hour Boost', 24, 20.00, 1),
  ('48-Hour Boost', 48, 50.00, 2),
  ('72-Hour Boost', 72, 100.00, 3);

-- ============================================================
-- L2. boosts
-- ============================================================
CREATE TABLE betk.boosts (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             UUID           NOT NULL REFERENCES betk.listings(id),
  store_id               UUID           NOT NULL REFERENCES betk.stores(id),
  package_id             UUID           NOT NULL REFERENCES betk.boost_packages(id),
  payment_method         payout_method  NOT NULL,
  amount_paid            NUMERIC(10,2)  NOT NULL,
  status                 boost_status   NOT NULL DEFAULT 'pending_payment',
  payment_confirmed_by   UUID           REFERENCES betk.users(id),
  payment_confirmed_at   TIMESTAMPTZ,
  starts_at              TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,
  views_during_boost     INTEGER        NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Prevent concurrent active boosts on same listing
CREATE UNIQUE INDEX uq_active_boost_per_listing
  ON betk.boosts (listing_id)
  WHERE status = 'active';

-- ============================================================
-- M1. notifications
-- ============================================================
CREATE TABLE betk.notifications (
  id        UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID                  NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  type      VARCHAR(50)           NOT NULL,
  channel   notification_channel  NOT NULL,
  title     VARCHAR(200),
  body      TEXT                  NOT NULL,
  data      JSONB,
  is_read   BOOLEAN               NOT NULL DEFAULT FALSE,
  sent_at   TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  read_at   TIMESTAMPTZ
);

-- ============================================================
-- M2. collections
-- ============================================================
CREATE TABLE betk.collections (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar           VARCHAR(100)       NOT NULL,
  name_en           VARCHAR(100),
  description_ar    TEXT,
  homepage_position SMALLINT           NOT NULL,
  status            collection_status  NOT NULL DEFAULT 'draft',
  publish_at        TIMESTAMPTZ,
  archive_at        TIMESTAMPTZ,
  created_by        UUID               NOT NULL REFERENCES betk.users(id),
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ============================================================
-- M3. collection_listings
-- ============================================================
CREATE TABLE betk.collection_listings (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  UUID         NOT NULL REFERENCES betk.collections(id) ON DELETE CASCADE,
  listing_id     UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  sort_order     SMALLINT     NOT NULL,
  added_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_collection_listing UNIQUE (collection_id, listing_id)
);

-- ============================================================
-- M4. flagged_content
-- ============================================================
CREATE TABLE betk.flagged_content (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  content_type  NOT NULL,
  content_id    UUID          NOT NULL,
  reported_by   UUID          REFERENCES betk.users(id),
  reporter_type sender_type   NOT NULL,
  reason        flag_reason   NOT NULL,
  notes         TEXT,
  severity      flag_severity NOT NULL DEFAULT 'medium',
  status        flag_status   NOT NULL DEFAULT 'pending',
  reviewed_by   UUID          REFERENCES betk.users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- M5. moderation_logs
-- Immutable audit trail
-- ============================================================
CREATE TABLE betk.moderation_logs (
  id           UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID                NOT NULL REFERENCES betk.users(id),
  action       VARCHAR(50)         NOT NULL,
  target_type  moderation_target   NOT NULL,
  target_id    UUID                NOT NULL,
  reason       TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE RULE no_update_mod_log AS ON UPDATE TO betk.moderation_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_mod_log AS ON DELETE TO betk.moderation_logs DO INSTEAD NOTHING;

-- ============================================================
-- M6. whatsapp_templates
-- ============================================================
CREATE TABLE betk.whatsapp_templates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  event_type     VARCHAR(50)  NOT NULL,
  language       VARCHAR(5)   NOT NULL DEFAULT 'ar',
  body_template  TEXT         NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wa_template_name UNIQUE (name)
);

-- ============================================================
-- M7. admin_settings
-- ============================================================
CREATE TABLE betk.admin_settings (
  key         VARCHAR(100)  PRIMARY KEY,
  value       TEXT          NOT NULL,
  description TEXT,
  updated_by  UUID          REFERENCES betk.users(id),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO betk.admin_settings (key, value, description) VALUES
  ('seller_approval_sla_hours', '24', 'Hours before seller approval SLA breaches'),
  ('dispute_sla_hours', '48', 'Hours before dispute SLA breaches'),
  ('low_stock_default_threshold', '3', 'Default low stock alert threshold'),
  ('min_payout_egp', '100', 'Minimum payout amount in EGP'),
  ('review_edit_window_hours', '48', 'Hours buyer can edit a review after submission'),
  ('max_listing_images', '5', 'Maximum images per listing'),
  ('max_listing_tags', '5', 'Maximum tags per listing'),
  ('silver_level_min_orders', '10', 'Minimum orders for Silver level'),
  ('silver_level_min_rating', '4.0', 'Minimum rating for Silver level'),
  ('gold_level_min_orders', '50', 'Minimum orders for Gold level'),
  ('gold_level_min_rating', '4.5', 'Minimum rating for Gold level');

-- ============================================================
-- M8. seller_analytics_snapshots
-- ============================================================
CREATE TABLE betk_analytics.seller_snapshots (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID           NOT NULL REFERENCES betk.stores(id),
  snapshot_date    DATE           NOT NULL,
  profile_views    INTEGER        NOT NULL DEFAULT 0,
  listing_views    INTEGER        NOT NULL DEFAULT 0,
  inquiries_received INTEGER      NOT NULL DEFAULT 0,
  orders_confirmed INTEGER        NOT NULL DEFAULT 0,
  revenue_egp      NUMERIC(12,2)  NOT NULL DEFAULT 0,
  CONSTRAINT uq_seller_snapshot UNIQUE (store_id, snapshot_date)
);

-- ============================================================
-- M9. platform_analytics_snapshots
-- ============================================================
CREATE TABLE betk_analytics.platform_snapshots (
  snapshot_date         DATE           PRIMARY KEY,
  total_sellers_active  INTEGER        NOT NULL DEFAULT 0,
  total_buyers          INTEGER        NOT NULL DEFAULT 0,
  new_sellers           INTEGER        NOT NULL DEFAULT 0,
  new_buyers            INTEGER        NOT NULL DEFAULT 0,
  gmv_egp               NUMERIC(14,2)  NOT NULL DEFAULT 0,
  orders_created        INTEGER        NOT NULL DEFAULT 0,
  orders_delivered      INTEGER        NOT NULL DEFAULT 0,
  disputes_opened       INTEGER        NOT NULL DEFAULT 0,
  disputes_resolved     INTEGER        NOT NULL DEFAULT 0,
  boost_revenue_egp     NUMERIC(12,2)  NOT NULL DEFAULT 0
);
