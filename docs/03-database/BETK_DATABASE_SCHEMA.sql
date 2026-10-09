-- ============================================================
-- BETK_DATABASE_SCHEMA.sql  —  AUTHORITATIVE, COMPLETE SCHEMA
-- PostgreSQL 17 / Supabase. Source: Architecture Conversation 3 (Step 5),
-- reproduced verbatim, with the MVP FREEZE deltas (signed 2026-06-13) applied:
--   OD-4: auth_provider enum; users.phone_number nullable; users.auth_provider;
--         verified-phone transaction gate (RESTRICTIVE policies, end of file).
--   OD-2: users.deleted_at / users.anonymized_at (deactivate-only in MVP).
-- Contents: 5 extensions, 3 schemas, 34 enums (incl. auth_provider), 43 tables
--   (with interleaved triggers), circular-FK ALTERs, 40 indexes, helper
--   functions is_admin()/my_store_id(), RLS enable + 31 policies + 3 phone-gate
--   RESTRICTIVE policies, 6 pg_cron jobs.
-- Migration order: follow Architecture Conversation 3 Step 6 (057 steps);
--   summarized in BETK_ERD.md §9. Triggers appear inline after their tables.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram similarity for search
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Arabic/accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "pg_cron";        -- Scheduled jobs
-- Create custom schemas
CREATE SCHEMA IF NOT EXISTS betk;
CREATE SCHEMA IF NOT EXISTS betk_analytics;
CREATE SCHEMA IF NOT EXISTS betk_audit;
-- Set search path
SET search_path TO betk, public;
-- Supabase auth integration note:
-- users.id references auth.users(id) in Supabase
-- This allows Supabase Auth to manage OTP and sessions natively
-- betk.users mirrors auth.users with platform-specific fields
# **2. Enum Type Definitions**
**  SQL**
-- ============================================================
-- All ENUM types must be created before tables
-- ============================================================
-- User & Auth
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin', 'superadmin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'pending');
-- Seller & Store
CREATE TYPE seller_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE seller_level AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE strike_type AS ENUM ('warning', 'temp_suspension', 'permanent_ban');
CREATE TYPE store_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE doc_type AS ENUM ('national_id_front', 'national_id_back');
CREATE TYPE doc_review_status AS ENUM ('pending', 'approved', 'rejected');
-- Listings
CREATE TYPE listing_type AS ENUM ('product', 'service');
CREATE TYPE price_type AS ENUM ('fixed', 'per_hour', 'starting_from', 'quote_only');
CREATE TYPE listing_status AS ENUM ('draft', 'active', 'sold_out', 'paused', 'removed');
-- Inquiries & Messaging
CREATE TYPE inquiry_status AS ENUM ('open', 'replied', 'confirmed', 'declined', 'expired');
CREATE TYPE sender_type AS ENUM ('buyer', 'seller', 'admin', 'system');
CREATE TYPE delivery_preference AS ENUM ('delivery', 'pickup', 'remote');
-- Orders
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'dispatched',
  'delivered', 'cancelled', 'returned'
);
CREATE TYPE cancelled_by_type AS ENUM ('buyer', 'seller', 'admin', 'system');
-- Payments
CREATE TYPE payment_type AS ENUM ('deposit', 'balance');
CREATE TYPE payment_method AS ENUM ('instapay', 'vodafone_cash', 'orange_cash', 'cod');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
CREATE TYPE payout_method AS ENUM ('instapay', 'vodafone_cash', 'orange_cash');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'processed', 'rejected');
-- Delivery
CREATE TYPE shipment_status AS ENUM (
  'created', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'failed', 'returned'
);
-- Reviews & Disputes
CREATE TYPE dispute_reason AS ENUM (
  'not_received', 'not_as_described', 'damaged',
  'wrong_item', 'return_request', 'refund_request'
);
CREATE TYPE dispute_status AS ENUM (
  'submitted', 'under_review', 'awaiting_seller', 'resolved', 'closed'
);
CREATE TYPE dispute_resolution AS ENUM (
  'buyer_favour', 'seller_favour', 'partial', 'no_action'
);
-- Boosts
CREATE TYPE boost_status AS ENUM (
  'pending_payment', 'active', 'expired', 'cancelled'
);
-- Admin & Moderation
CREATE TYPE flag_reason AS ENUM (
  'misleading', 'counterfeit', 'inappropriate',
  'spam', 'prohibited', 'wrong_category'
);
CREATE TYPE flag_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'actioned', 'dismissed');
CREATE TYPE content_type AS ENUM ('listing', 'review');
CREATE TYPE moderation_target AS ENUM (
  'seller', 'buyer', 'listing', 'review', 'dispute', 'payout'
);
CREATE TYPE notification_channel AS ENUM ('push', 'sms', 'whatsapp', 'email');
CREATE TYPE collection_status AS ENUM ('draft', 'live', 'scheduled', 'archived');
-- MVP FREEZE (OD-4): identity origin for phone-OTP + Google OAuth
CREATE TYPE auth_provider AS ENUM ('phone', 'google');
# **3. Complete SQL — All 28 Tables**
## **Group A: Identity ****&**** Authentication**
**  SQL**
-- ============================================================
-- A1. users
-- Central identity for all platform participants
-- ============================================================
CREATE TABLE betk.users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number     VARCHAR(15),                            -- OD-4: NULLABLE (was NOT NULL); UNIQUE still holds (Postgres allows multiple NULLs)
  auth_provider    auth_provider NOT NULL DEFAULT 'phone', -- OD-4: 'phone' | 'google'
  role             user_role    NOT NULL DEFAULT 'buyer',
  status           user_status  NOT NULL DEFAULT 'active',
  deleted_at       TIMESTAMPTZ,                            -- OD-2: deactivate-only (login blocked when set; R-A05)
  anonymized_at    TIMESTAMPTZ,                            -- OD-2: reserved for post-MVP MW1 anonymization
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ,
  CONSTRAINT uq_users_phone UNIQUE (phone_number)
);
-- A2. otp_tokens
-- Short-lived phone verification tokens
-- ============================================================
CREATE TABLE betk.otp_tokens (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(15)  NOT NULL,
  token_hash    VARCHAR(64)  NOT NULL,
  expires_at    TIMESTAMPTZ  NOT NULL,
  is_used       BOOLEAN      NOT NULL DEFAULT FALSE,
  attempt_count SMALLINT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_otp_attempts CHECK (attempt_count <= 5)
);
-- A3. sessions
-- Active authenticated user sessions
-- ============================================================
CREATE TABLE betk.sessions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  token_hash     VARCHAR(64)  NOT NULL,
  device_info    JSONB,
  expires_at     TIMESTAMPTZ  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sessions_token UNIQUE (token_hash)
);
## **Group B: User Management**
**  SQL**
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
## **Group C: Seller Management**
**  SQL**
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
## **Group D: Store Management**
**  SQL**
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
-- D2. store_follows
-- ============================================================
CREATE TABLE betk.store_follows (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id    UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  store_id    UUID         NOT NULL REFERENCES betk.stores(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_store_follow UNIQUE (buyer_id, store_id)
);
## **Group E: Product Catalog**
**  SQL**
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
-- Auto-update search_vector on insert/update
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
-- E4. listing_tags
-- ============================================================
CREATE TABLE betk.listing_tags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID         NOT NULL REFERENCES betk.listings(id) ON DELETE CASCADE,
  tag         VARCHAR(30)  NOT NULL,
  CONSTRAINT uq_listing_tag UNIQUE (listing_id, tag)
);
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
## **Group F: Messaging ****&**** Inquiries**
**  SQL**
-- ============================================================
-- F1. inquiries
-- ============================================================
CREATE TABLE betk.inquiries (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                UUID                 NOT NULL REFERENCES betk.users(id),
  store_id                UUID                 NOT NULL REFERENCES betk.stores(id),
  listing_id              UUID                 NOT NULL REFERENCES betk.listings(id),
  quantity                SMALLINT             CHECK (quantity > 0),
  delivery_preference     delivery_preference,
  special_requests        TEXT,
  status                  inquiry_status       NOT NULL DEFAULT 'open',
  converted_to_order_id   UUID,
  buyer_first_message     TEXT                 NOT NULL,
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  last_message_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);
-- F2. inquiry_messages
-- ============================================================
CREATE TABLE betk.inquiry_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  UUID         NOT NULL REFERENCES betk.inquiries(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES betk.users(id),
  sender_type sender_type  NOT NULL,
  body        TEXT         NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- F3. order_messages
-- Post-order communication (separate from inquiry thread)
-- ============================================================
CREATE TABLE betk.order_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID         NOT NULL,
  sender_id   UUID         NOT NULL REFERENCES betk.users(id),
  sender_type sender_type  NOT NULL,
  body        TEXT         NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
## **Group G: Orders**
**  SQL**
-- ============================================================
-- G1. orders
-- ============================================================
CREATE TABLE betk.orders (
  id                   UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  betk_ref             VARCHAR(25)          NOT NULL,
  buyer_id             UUID                 NOT NULL REFERENCES betk.users(id),
  store_id             UUID                 NOT NULL REFERENCES betk.stores(id),
  inquiry_id           UUID                 REFERENCES betk.inquiries(id),
  delivery_address_id  UUID                 REFERENCES betk.addresses(id),
  delivery_method      delivery_preference  NOT NULL,
  delivery_fee         NUMERIC(10,2)        NOT NULL DEFAULT 0,
  subtotal             NUMERIC(10,2)        NOT NULL,
  total_amount         NUMERIC(10,2)        NOT NULL,
  status               order_status         NOT NULL DEFAULT 'pending',
  cancelled_by         cancelled_by_type,
  cancellation_reason  TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  confirmed_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  CONSTRAINT uq_orders_betk_ref UNIQUE (betk_ref),
  CONSTRAINT chk_order_total CHECK (total_amount = subtotal + delivery_fee)
);
-- Add FK for order_messages after orders table exists
ALTER TABLE betk.order_messages
  ADD CONSTRAINT fk_order_messages_order
  FOREIGN KEY (order_id) REFERENCES betk.orders(id) ON DELETE CASCADE;
-- Add FK for inquiries converted_to_order_id
ALTER TABLE betk.inquiries
  ADD CONSTRAINT fk_inquiries_order
  FOREIGN KEY (converted_to_order_id) REFERENCES betk.orders(id);
-- G2. order_items
-- ============================================================
CREATE TABLE betk.order_items (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID           NOT NULL REFERENCES betk.orders(id) ON DELETE CASCADE,
  listing_id       UUID           NOT NULL REFERENCES betk.listings(id),
  listing_title_ar VARCHAR(80)    NOT NULL,
  quantity         SMALLINT       NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2)  NOT NULL CHECK (unit_price > 0),
  subtotal         NUMERIC(10,2)  NOT NULL,
  CONSTRAINT chk_order_item_subtotal CHECK (subtotal = quantity * unit_price)
);
-- G3. order_status_history
-- Immutable append-only log
-- ============================================================
CREATE TABLE betk.order_status_history (
  id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID                 NOT NULL REFERENCES betk.orders(id),
  from_status      order_status,
  to_status        order_status         NOT NULL,
  changed_by       UUID                 REFERENCES betk.users(id),
  changed_by_type  cancelled_by_type    NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);
-- Prevent updates and deletes on status history
CREATE RULE no_update_order_history AS ON UPDATE TO betk.order_status_history DO INSTEAD NOTHING;
CREATE RULE no_delete_order_history AS ON DELETE TO betk.order_status_history DO INSTEAD NOTHING;
-- ── stock decrement on order confirmation (R-L05/R-L06) ───────────────────────
-- Fires when an order transitions INTO 'confirmed' (seller confirm, R-L05 — NOT
-- at checkout). Decrements each ordered listing's tracked stock_qty by the ordered
-- quantity, and flips an active listing to 'sold_out' when its stock reaches 0
-- (R-L06). Untracked stock (stock_qty IS NULL — services / made-to-order) is left
-- unchanged. The listings CHECK (stock_qty >= 0) is the authoritative oversell
-- guard: a confirm that would drive stock negative raises and rolls back the
-- confirmation (no clamping). SECURITY DEFINER + pinned search_path so the
-- system-integrity bookkeeping always runs regardless of the confirming role's RLS
-- (matches the search_path-pinning security-advisor pattern; trigger functions are
-- not RPC-exposed, so no SECURITY DEFINER RPC-exposure advisor applies).
CREATE OR REPLACE FUNCTION betk.decrement_stock_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = betk, public
AS $$
BEGIN
  UPDATE betk.listings AS l
  SET stock_qty  = l.stock_qty - oi.qty,
      status     = CASE
                     WHEN l.stock_qty - oi.qty = 0 AND l.status = 'active'
                     THEN 'sold_out'::betk.listing_status
                     ELSE l.status
                   END,
      updated_at = NOW()
  FROM (
    SELECT listing_id, SUM(quantity)::INTEGER AS qty
    FROM betk.order_items
    WHERE order_id = NEW.id
    GROUP BY listing_id
  ) AS oi
  WHERE l.id = oi.listing_id
    AND l.stock_qty IS NOT NULL;
  RETURN NEW;
END;
$$;
-- Lock down direct EXECUTE: a SECURITY DEFINER function is EXECUTE-able by PUBLIC
-- by default, which PostgREST would expose via /rest/v1/rpc (security-advisor
-- lints 0028/0029). This function is only ever invoked by its trigger, so revoke
-- the default grant — the trigger fires regardless of role EXECUTE privilege.
REVOKE EXECUTE ON FUNCTION betk.decrement_stock_on_confirm() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_decrement_stock_on_confirm
AFTER UPDATE OF status ON betk.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed')
EXECUTE FUNCTION betk.decrement_stock_on_confirm();
-- ── inquiry→order conversion link (REG-09 TENSION, Phase 07 / T01) ────────────
-- Checkout is buyer-driven (the buyer INSERTs the order), but inquiries UPDATE RLS
-- is store/admin only (inq_update) — the buyer cannot write inquiries.converted_to_order_id
-- from an INVOKER path. This hardened SECURITY DEFINER AFTER INSERT trigger copies the
-- new order id onto the source inquiry, once (idempotent via the IS NULL guard — first
-- order wins). Distinct from the ADR-012-rejected DEFINER *RPC*: this is a definer
-- *trigger*, never API-exposed (EXECUTE revoked below), so no 0028/0029 advisor applies.
-- Only the derived inquiry-linkage write is definer; the order INSERT stays RLS-gated
-- (orders_insert + orders_phone_gate). Migration 20260723074953_order_rls_and_conversion_link.
CREATE OR REPLACE FUNCTION betk.set_inquiry_converted_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = betk, public
AS $$
BEGIN
  UPDATE betk.inquiries
  SET converted_to_order_id = NEW.id
  WHERE id = NEW.inquiry_id
    AND converted_to_order_id IS NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION betk.set_inquiry_converted_order() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_set_inquiry_converted_order
AFTER INSERT ON betk.orders
FOR EACH ROW
WHEN (NEW.inquiry_id IS NOT NULL)
EXECUTE FUNCTION betk.set_inquiry_converted_order();
## **Group H: Payments**
**Split Payment Model (CUSTODIAL — OD-8 / ADR-016, amended 2026-07-23)**
deposit = 50% upfront to BETK's Instapay / Vodafone Cash / Orange Cash handles (from admin_settings); buyer uploads a transfer screenshot; ADMIN verifies (not the seller)
balance = 50% COD on delivery; courier collects and remits to BETK
Two payment records created per order at checkout; payee = BETK, which settles to the seller net of a platform commission (seller net = subtotal − commission_amount)
NOTE (OD-8 §9): the custodial model adds 3 additive columns — payments.proof_path, orders.commission_rate, orders.commission_amount — LANDED by migration 20260723110557_od8_custodial_payment_columns_and_settings (CORRECTION-03, 2026-07-23; ledger 29→30; no new table; count 43 holds). The original CREATE TABLE blocks below stay historical (landed by 20260622082914_payments_delivery.sql / 20260622082857_messaging_orders.sql, never edited retroactively); the additive columns + CHECKs are backfilled as an ALTER block below the payments table for source parity, and the 6 admin_settings rows are backfilled below the seed INSERT. RLS policies for the new write paths (REG-49: payments INSERT/UPDATE, orders UPDATE) are OWED BY the regenerated Phase-07 T02, NOT this migration.
**  SQL**
-- ============================================================
-- H1. payments
-- Split payment (CUSTODIAL, OD-8/ADR-016): deposit (upfront to BETK's rails, admin-verified) + balance (COD, remitted to BETK); payee = BETK, settles to seller net of commission
-- ============================================================
CREATE TABLE betk.payments (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID            NOT NULL REFERENCES betk.orders(id),
  payment_type        payment_type    NOT NULL,
  amount              NUMERIC(10,2)   NOT NULL CHECK (amount > 0),
  method              payment_method  NOT NULL,
  status              payment_status  NOT NULL DEFAULT 'pending',
  confirmed_by        UUID            REFERENCES betk.users(id),
  confirmed_at        TIMESTAMPTZ,
  transfer_reference  VARCHAR(100),
  notes               TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_type_per_order UNIQUE (order_id, payment_type)
);
-- OD-8 CUSTODIAL ADDITIVE COLUMNS + CHECKs (OD-8 §9, migration
-- 20260723110557_od8_custodial_payment_columns_and_settings; CORRECTION-03,
-- 2026-07-23; backfilled here for source parity). Additive only, nullable +
-- app-enforced; the CHECKs bite only once a value is set (NULL passes).
ALTER TABLE betk.payments
  ADD COLUMN proof_path VARCHAR NULL;                    -- OD-8 §5: buyer's transfer-screenshot path in the private `docs` bucket (awaiting-admin-review = proof_path IS NOT NULL AND status='pending')
ALTER TABLE betk.orders
  ADD COLUMN commission_rate NUMERIC(5,2) NULL;          -- OD-8 §4: platform commission rate (%) in force at creation (snapshot, from admin_settings.commission_rate_pct)
ALTER TABLE betk.orders
  ADD COLUMN commission_amount NUMERIC(10,2) NULL;       -- OD-8 §4: computed commission = round(commission_rate * subtotal, 2), snapshot; base is subtotal, NEVER total_amount; seller net = subtotal - commission_amount (derived, no wallet table)
ALTER TABLE betk.orders
  ADD CONSTRAINT chk_commission_amount_nonneg CHECK (commission_amount >= 0);
ALTER TABLE betk.orders
  ADD CONSTRAINT chk_commission_rate_range CHECK (commission_rate BETWEEN 0 AND 100);
-- H2. payouts
-- Seller earnings withdrawal requests
-- ============================================================
CREATE TABLE betk.payouts (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID           NOT NULL REFERENCES betk.stores(id),
  amount           NUMERIC(10,2)  NOT NULL CHECK (amount >= 100),
  method           payout_method  NOT NULL,
  account_details  VARCHAR(100)   NOT NULL,
  status           payout_status  NOT NULL DEFAULT 'pending',
  processed_by     UUID           REFERENCES betk.users(id),
  processed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  requested_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
## **Group I: Delivery**
**  SQL**
-- ============================================================
-- I1. shipments
-- ============================================================
CREATE TABLE betk.shipments (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID             NOT NULL REFERENCES betk.orders(id),
  courier         VARCHAR(50)      NOT NULL,
  tracking_number VARCHAR(100),
  tracking_url    TEXT,
  status          shipment_status  NOT NULL DEFAULT 'created',
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shipment_order UNIQUE (order_id)
);
-- I2. shipment_tracking_events
-- Immutable courier event log
-- ============================================================
CREATE TABLE betk.shipment_tracking_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  UUID         NOT NULL REFERENCES betk.shipments(id) ON DELETE CASCADE,
  status       VARCHAR(50)  NOT NULL,
  location     VARCHAR(100),
  description  TEXT,
  event_at     TIMESTAMPTZ  NOT NULL
);
## **Group J: Reviews ****&**** Ratings**
**  SQL**
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
-- Set edit_deadline on insert
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
-- J2. review_photos
-- ============================================================
CREATE TABLE betk.review_photos (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID         NOT NULL REFERENCES betk.reviews(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  sort_order  SMALLINT     NOT NULL CHECK (sort_order BETWEEN 0 AND 2),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
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
-- Auto-recalculate rating aggregate after review insert/update
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
## **Group K: Disputes**
**  SQL**
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
-- Set SLA deadline on insert
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
-- K2. dispute_evidence
-- ============================================================
CREATE TABLE betk.dispute_evidence (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID         NOT NULL REFERENCES betk.disputes(id) ON DELETE CASCADE,
  url         TEXT         NOT NULL,
  description VARCHAR(300),
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
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
## **Group L: Promotions ****&**** Boosts**
**  SQL**
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
## **Group M: Administration**
**  SQL**
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
-- OD-8 §9.1 custodial payment-config seed rows (migration
-- 20260723110557_od8_custodial_payment_columns_and_settings; CORRECTION-03,
-- 2026-07-23; backfilled here for source parity). Every value is PROVISIONAL and
-- gated by REG-62 (HARD pre-launch gate): 0 and '' are "not yet configured"
-- sentinels, NOT business decisions — no rate, fee, or handle is invented.
INSERT INTO betk.admin_settings (key, value, description) VALUES
  ('commission_rate_pct', '0', 'PROVISIONAL - platform commission, % of order subtotal. BETK EARNS NOTHING UNTIL SET. Hard pre-launch gate (REG-62).'),
  ('return_hold_hours', '48', 'PROVISIONAL - hours after delivery before a seller balance is approved. Engineering default, house-consistent with dispute_sla_hours / review_edit_window_hours - NOT spec-derived. Confirm before launch (REG-62).'),
  ('delivery_fee_flat_egp', '0', 'PROVISIONAL - flat delivery fee (Phase 07; retired when the courier API lands at Phase 08). Hard pre-launch gate (REG-62).'),
  ('betk_instapay_handle', '', 'BETK deposit-receipt handle - set via dashboard. Checkout cannot render payment instructions while empty. Hard gate (REG-62).'),
  ('betk_vodafone_cash', '', 'BETK deposit-receipt handle - set via dashboard (REG-62).'),
  ('betk_orange_cash', '', 'BETK deposit-receipt handle - set via dashboard (REG-62).');
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
# **4. Index Definitions**
**  SQL**
-- ============================================================
-- BETK Index Strategy
-- All indexes created AFTER table creation
-- ============================================================
-- ── USERS ──────────────────────────────────────────────────
CREATE INDEX idx_users_role ON betk.users (role);
CREATE INDEX idx_users_status ON betk.users (status);
-- ── SESSIONS ────────────────────────────────────────────────
CREATE INDEX idx_sessions_user ON betk.sessions (user_id);
CREATE INDEX idx_sessions_expires ON betk.sessions (expires_at);
-- ── OTP TOKENS ──────────────────────────────────────────────
CREATE INDEX idx_otp_phone ON betk.otp_tokens (phone_number, expires_at);
-- ── ADDRESSES ───────────────────────────────────────────────
CREATE INDEX idx_addresses_buyer ON betk.addresses (buyer_id);
-- ── SELLER_PROFILES ─────────────────────────────────────────
CREATE INDEX idx_seller_status ON betk.seller_profiles (status);
CREATE INDEX idx_seller_submitted ON betk.seller_profiles (submitted_at) WHERE status = 'pending';
-- ── STORES ──────────────────────────────────────────────────
CREATE INDEX idx_stores_status ON betk.stores (status);
CREATE INDEX idx_stores_gov ON betk.stores (governorate, status);
CREATE INDEX idx_stores_category ON betk.stores (category_primary, status);
-- ── LISTINGS (most critical) ─────────────────────────────────
-- Full-text search - GIN index on tsvector
CREATE INDEX idx_listings_search ON betk.listings USING GIN (search_vector);
-- Trigram index for partial-match (backup for short queries)
CREATE INDEX idx_listings_title_trgm ON betk.listings USING GIN (title_ar gin_trgm_ops);
-- Filtered by status (most common query pattern)
CREATE INDEX idx_listings_store_status ON betk.listings (store_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_category_status ON betk.listings (category_id, status)
  WHERE deleted_at IS NULL;
-- New arrivals sort
CREATE INDEX idx_listings_new ON betk.listings (created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;
-- Popularity sort
CREATE INDEX idx_listings_popular ON betk.listings (view_count DESC)
  WHERE status = 'active' AND deleted_at IS NULL;
-- Location-based discovery
CREATE INDEX idx_listings_gov ON betk.listings (store_id)
  WHERE status = 'active' AND deleted_at IS NULL;
-- ── INQUIRIES ───────────────────────────────────────────────
CREATE INDEX idx_inquiries_store ON betk.inquiries (store_id, status);
CREATE INDEX idx_inquiries_buyer ON betk.inquiries (buyer_id);
CREATE INDEX idx_inquiries_inbox ON betk.inquiries (store_id, last_message_at DESC);
-- ── ORDERS ──────────────────────────────────────────────────
CREATE INDEX idx_orders_buyer ON betk.orders (buyer_id, status);
CREATE INDEX idx_orders_store ON betk.orders (store_id, status);
CREATE INDEX idx_orders_store_date ON betk.orders (store_id, created_at DESC);
-- ── ORDER_STATUS_HISTORY ─────────────────────────────────────
CREATE INDEX idx_osh_order ON betk.order_status_history (order_id, created_at DESC);
-- ── PAYMENTS ────────────────────────────────────────────────
CREATE INDEX idx_payments_order ON betk.payments (order_id);
CREATE INDEX idx_payments_status ON betk.payments (status) WHERE status = 'pending';
-- ── PAYOUTS ─────────────────────────────────────────────────
CREATE INDEX idx_payouts_store ON betk.payouts (store_id);
CREATE INDEX idx_payouts_pending ON betk.payouts (requested_at) WHERE status = 'pending';
-- ── REVIEWS ─────────────────────────────────────────────────
CREATE INDEX idx_reviews_store ON betk.reviews (store_id) WHERE is_visible = TRUE;
-- ── DISPUTES ────────────────────────────────────────────────
CREATE INDEX idx_disputes_status_sla ON betk.disputes (status, sla_deadline)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_disputes_store ON betk.disputes (store_id);
-- ── BOOSTS ──────────────────────────────────────────────────
-- Partial unique already created above (uq_active_boost_per_listing)
CREATE INDEX idx_boosts_expires ON betk.boosts (expires_at)
  WHERE status = 'active';
-- ── NOTIFICATIONS ───────────────────────────────────────────
CREATE INDEX idx_notif_user_unread ON betk.notifications (user_id)
  WHERE is_read = FALSE;
CREATE INDEX idx_notif_user_date ON betk.notifications (user_id, sent_at DESC);
-- ── FLAGGED_CONTENT ─────────────────────────────────────────
CREATE INDEX idx_flagged_pending ON betk.flagged_content (severity, created_at)
  WHERE status = 'pending';
-- ── MODERATION_LOGS ─────────────────────────────────────────
CREATE INDEX idx_modlog_target ON betk.moderation_logs (target_id, target_type);
CREATE INDEX idx_modlog_admin ON betk.moderation_logs (admin_id, created_at DESC);
-- ── ANALYTICS ───────────────────────────────────────────────
CREATE INDEX idx_seller_snap_store ON betk_analytics.seller_snapshots (store_id, snapshot_date DESC);
CREATE INDEX idx_seller_snap_date ON betk_analytics.seller_snapshots (snapshot_date DESC);
# **5. Row Level Security (RLS) Policies**
**RLS Design Principles**
1. Every table has RLS ENABLED — no exceptions
2. Admins (role = admin or superadmin) bypass RLS via a helper function
3. Service role (Supabase server-side) bypasses RLS for background jobs
4. Default deny: if no policy matches, access is denied
5. Sellers see only their own store data
6. Buyers see only their own orders, addresses, and notifications
**  SQL**
-- ============================================================
-- Helper function: check if current user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION betk.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM betk.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;
-- Helper: get current user's store_id
CREATE OR REPLACE FUNCTION betk.my_store_id()
RETURNS UUID AS $$
  SELECT id FROM betk.stores WHERE seller_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE betk.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.otp_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.sessions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.buyer_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.addresses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.seller_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.seller_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.seller_strikes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.stores                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.store_follows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.listings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.listing_images           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.listing_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.wishlists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.restock_alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.inquiries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.inquiry_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.order_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.order_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.order_status_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.payouts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.shipments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.shipment_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.reviews                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.review_photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.rating_aggregates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.disputes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.dispute_evidence         ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.dispute_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.boosts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.boost_packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.collections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.collection_listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.flagged_content          ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.moderation_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.whatsapp_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk.admin_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk_analytics.seller_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE betk_analytics.platform_snapshots ENABLE ROW LEVEL SECURITY;
**  SQL**
-- ============================================================
-- RLS POLICIES
-- ============================================================
-- USERS: own record only; admins see all
CREATE POLICY users_self ON betk.users FOR SELECT
  USING (id = auth.uid() OR betk.is_admin());
-- BUYER_PROFILES: own record; public name/gov for discovery
CREATE POLICY bp_self ON betk.buyer_profiles FOR ALL
  USING (id = auth.uid() OR betk.is_admin());
-- ADDRESSES: own addresses only
CREATE POLICY addr_self ON betk.addresses FOR ALL
  USING (buyer_id = auth.uid() OR betk.is_admin());
-- SELLER_PROFILES: own + public read; admin full
CREATE POLICY sp_select ON betk.seller_profiles FOR SELECT
  USING (id = auth.uid() OR status = 'active' OR betk.is_admin());
CREATE POLICY sp_update ON betk.seller_profiles FOR UPDATE
  USING (id = auth.uid() OR betk.is_admin());
-- Permissive ownership INSERT (ERD §3 seller_profiles INSERT = self). Originally
-- SPECCED but the CREATE POLICY was omitted from this SQL contract (only the
-- RESTRICTIVE seller_profiles_phone_gate existed → INSERT impossible for all);
-- restored additively by migration 20260719133011_seller_ownership_insert_rls.sql
-- (Phase 04 / T01, REG-10). COMBINES with the RESTRICTIVE phone gate below (both
-- must hold): a phone-verified user inserts their own row; phone-NULL is blocked.
CREATE POLICY sp_insert ON betk.seller_profiles FOR INSERT
  WITH CHECK (id = auth.uid());
-- SELLER_DOCUMENTS: own seller only; admin (FOR ALL → own SELECT/INSERT/UPDATE,
-- USING serves as the INSERT WITH CHECK). ERD §3 fully satisfied — no additions.
CREATE POLICY sdoc_own ON betk.seller_documents FOR ALL
  USING (seller_id = auth.uid() OR betk.is_admin());
-- STORES: public read active; seller manages own
CREATE POLICY stores_public ON betk.stores FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid() OR betk.is_admin());
CREATE POLICY stores_manage ON betk.stores FOR UPDATE
  USING (seller_id = auth.uid() OR betk.is_admin());
-- Permissive ownership INSERT (ERD §3 stores INSERT = own). Originally SPECCED
-- but the CREATE POLICY was omitted from this SQL contract (only stores_public
-- SELECT + stores_manage UPDATE existed → INSERT uncovered); restored additively
-- by migration 20260719133011_seller_ownership_insert_rls.sql (Phase 04 / T01,
-- REG-31 — 3rd instance of the open-issue-#14 / REG-29 class). No RESTRICTIVE
-- phone gate on stores (ERD gates only orders/seller_profiles/payouts).
CREATE POLICY stores_insert ON betk.stores FOR INSERT
  WITH CHECK (seller_id = auth.uid());
-- STORE_FOLLOWS: self-scope (ERD §3 line 45). Originally SPECCED but the
-- CREATE POLICY statements were omitted from this SQL contract (table left
-- RLS-enabled + zero policies → default-deny); restored additively by
-- migration 20260718153021_store_follows_self_scope_rls.sql (Phase 03 / T06,
-- REG-29 — 2nd instance of the open-issue-#14 class). No UPDATE policy (ERD
-- pins UPDATE = "—"; a follow row is toggled by insert/delete, never updated).
CREATE POLICY sf_select_self ON betk.store_follows FOR SELECT
  USING (buyer_id = auth.uid() OR betk.is_admin());
CREATE POLICY sf_insert_self ON betk.store_follows FOR INSERT
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY sf_delete_self ON betk.store_follows FOR DELETE
  USING (buyer_id = auth.uid());
-- CATEGORIES: public read
CREATE POLICY cat_public ON betk.categories FOR SELECT
  USING (is_active = TRUE OR betk.is_admin());
CREATE POLICY cat_admin ON betk.categories FOR ALL
  USING (betk.is_admin());
-- LISTINGS: public read active + sold_out; seller manages own
-- REG-25 (migration 20260718230302): sold_out kept publicly visible for the
-- listing-detail restock CTA (FR-PUB-4/R-N06). Browse grids stay active-only
-- via the query layer, NOT RLS. draft/paused/removed/soft-deleted stay hidden.
CREATE POLICY listings_public ON betk.listings FOR SELECT
  USING (
    (status IN ('active', 'sold_out') AND deleted_at IS NULL)
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
CREATE POLICY listings_seller ON betk.listings FOR ALL
  USING (store_id = betk.my_store_id() OR betk.is_admin());
-- CATALOG PUBLIC-READ CHILD POLICIES (T01-FIX, migration 20260630232657;
-- backfilled here for source parity). Each follows a publicly-visible parent.
-- REG-25 (migration 20260718230302) amended listing_images_public /
-- listing_tags_public to track the parent's active+sold_out set so a sold_out
-- detail page still renders its gallery + tag chips. review_photos_public
-- (via visible review), collection_listings_public (via live collection), and
-- rating_aggregates_public (public aggregate) do NOT reference listing status.
CREATE POLICY listing_images_public ON betk.listing_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_images.listing_id
        AND l.status IN ('active', 'sold_out')
        AND l.deleted_at IS NULL
    )
  );
CREATE POLICY listing_tags_public ON betk.listing_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.listings l
      WHERE l.id = listing_tags.listing_id
        AND l.status IN ('active', 'sold_out')
        AND l.deleted_at IS NULL
    )
  );
-- LISTING-CHILDREN OWNER-WRITE POLICIES (REG-34, migration
-- 20260721111355_listing_children_owner_write_rls; backfilled here for source
-- parity). ERD §3 row 48: listing_images/listing_tags INSERT/UPDATE/DELETE =
-- "own store" was SPECCED but the CREATE POLICY was omitted from this SQL
-- contract (children carried ONLY their public SELECT policy above -> owner
-- write default-denied), the 4th instance of the open-issue-#14 / REG-29 /
-- REG-31 class. Shape mirrors the parent listings_seller (FOR ALL USING,
-- own store OR admin), scoped to the child via the owning listing. FOR ALL: the
-- USING clause governs SELECT/UPDATE/DELETE visibility AND is the implicit
-- WITH CHECK for INSERT/UPDATE; it OR-combines (PERMISSIVE) with the public
-- SELECT policy above, reconstructing row 48's "follows listing" SELECT.
-- restock_alerts stays policy-less (Phase 12 / notifications).
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
CREATE POLICY review_photos_public ON betk.review_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.reviews r
      WHERE r.id = review_photos.review_id
        AND r.is_visible = TRUE
    )
  );
CREATE POLICY collection_listings_public ON betk.collection_listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.collections c
      WHERE c.id = collection_listings.collection_id
        AND c.status = 'live'
    )
  );
CREATE POLICY rating_aggregates_public ON betk.rating_aggregates FOR SELECT
  USING (TRUE);
-- WISHLISTS: own buyer only
CREATE POLICY wishlist_own ON betk.wishlists FOR ALL
  USING (buyer_id = auth.uid() OR betk.is_admin());
-- INQUIRIES: buyer sees own; seller sees their store inquiries
CREATE POLICY inq_buyer ON betk.inquiries FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
-- REG-41 (Phase 06 / T01): ERD §3 rows 51-52 — inquiries INSERT=buyer, UPDATE=store/admin
--   (SELECT already covered by inq_buyer above); inquiry_messages SELECT/INSERT=thread parties,
--   UPDATE=sender, no DELETE. Migration 20260722115026_inquiry_messaging_rls.
CREATE POLICY inq_insert ON betk.inquiries FOR INSERT
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY inq_update ON betk.inquiries FOR UPDATE
  USING (store_id = betk.my_store_id() OR betk.is_admin())
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());
-- INQUIRY_MESSAGES: thread parties (parent inquiry's buyer or store) read+send; sender edits own
CREATE POLICY inq_msg_select ON betk.inquiry_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY inq_msg_insert ON betk.inquiry_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY inq_msg_update ON betk.inquiry_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
-- REG-42 (Phase 06 / T02-FIX): receiver read-receipt write, under the AUTHORIZED ERD §3 row-52
--   amendment (2026-07-22) — RECEIVER may flip is_read on the OTHER party's messages. Column
--   safety = GRANT (authenticated's table UPDATE re-scoped to is_read only, the REVOKE/GRANT
--   below — narrows the schema-wide grant from 0013_grants for this one table), row safety =
--   this policy. inq_msg_update (sender) left intact but now column-confined to is_read.
--   service_role/postgres/anon grants unchanged. Migration 20260722124510_inquiry_read_receipt_rls.
REVOKE UPDATE ON betk.inquiry_messages FROM authenticated;
GRANT UPDATE (is_read) ON betk.inquiry_messages TO authenticated;
CREATE POLICY inq_msg_read_receipt ON betk.inquiry_messages FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
-- ORDERS: buyer sees own; seller sees their store orders
CREATE POLICY orders_access ON betk.orders FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
-- PAYMENTS: buyer and seller of the order; admin
CREATE POLICY payments_access ON betk.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id())
    )
    OR betk.is_admin()
  );
-- REG-09 + REG-48 (Phase 07 / T01): ERD §3 rows 53-59 order-set RLS. orders permissive
--   ownership INSERT (combines with the RESTRICTIVE orders_phone_gate below); children
--   parent-scoped READ + INSERT. order_status_history UPDATE/DELETE stay blocked by the
--   append-only RULES (no policy). order_messages INSERT pins sender_id; no read-state
--   write (row 53 not REG-42-amended). shipments/shipment_tracking_events READ land now
--   (FR-BUY-9 tracking); their store/courier WRITE policies defer to Phase 08. payments
--   INSERT/UPDATE + orders UPDATE are REG-49, owed by T02. Migration
--   20260723074953_order_rls_and_conversion_link.
CREATE POLICY orders_insert ON betk.orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY order_items_access ON betk.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_items.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_items_insert ON betk.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_items.order_id
        AND o.buyer_id = auth.uid()
    )
  );
CREATE POLICY order_status_history_access ON betk.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_status_history_insert ON betk.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_messages_access ON betk.order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_messages_insert ON betk.order_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY shipments_access ON betk.shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = shipments.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY shipment_tracking_events_access ON betk.shipment_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.shipments s
      JOIN betk.orders o ON o.id = s.order_id
      WHERE s.id = shipment_tracking_events.shipment_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
-- REVIEWS: public read visible; buyer writes own
CREATE POLICY reviews_public ON betk.reviews FOR SELECT
  USING (is_visible = TRUE OR buyer_id = auth.uid() OR betk.is_admin());
CREATE POLICY reviews_buyer ON betk.reviews FOR INSERT
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY reviews_edit ON betk.reviews FOR UPDATE
  USING (
    (buyer_id = auth.uid() AND NOW() < edit_deadline)
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
-- DISPUTES: buyer and seller of the order; admin
CREATE POLICY disputes_access ON betk.disputes FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
-- NOTIFICATIONS: own user only
CREATE POLICY notif_own ON betk.notifications FOR ALL
  USING (user_id = auth.uid() OR betk.is_admin());
-- COLLECTIONS: public read live; admin manages
CREATE POLICY collections_public ON betk.collections FOR SELECT
  USING (status = 'live' OR betk.is_admin());
CREATE POLICY collections_admin ON betk.collections FOR ALL
  USING (betk.is_admin());
-- MODERATION_LOGS: admin read only
CREATE POLICY modlog_admin ON betk.moderation_logs FOR SELECT
  USING (betk.is_admin());
-- ADMIN_SETTINGS: admin read/write
CREATE POLICY settings_admin ON betk.admin_settings FOR ALL
  USING (betk.is_admin());
-- ANALYTICS: seller sees own; admin sees all
CREATE POLICY seller_snap_own ON betk_analytics.seller_snapshots FOR SELECT
  USING (store_id = betk.my_store_id() OR betk.is_admin());
CREATE POLICY platform_snap_admin ON betk_analytics.platform_snapshots FOR SELECT
  USING (betk.is_admin());
-- PAYOUTS: seller sees own; admin manages
CREATE POLICY payouts_own ON betk.payouts FOR SELECT
  USING (store_id = betk.my_store_id() OR betk.is_admin());
CREATE POLICY payouts_insert ON betk.payouts FOR INSERT
  WITH CHECK (store_id = betk.my_store_id());
-- BOOSTS: seller sees own; public reads active for search ranking
CREATE POLICY boosts_public ON betk.boosts FOR SELECT
  USING (
    status = 'active'
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
-- BOOST_PACKAGES: public read active packages
CREATE POLICY boost_pkg_public ON betk.boost_packages FOR SELECT
  USING (is_active = TRUE OR betk.is_admin());
# **6. Scheduled Jobs (pg_cron)**
**  SQL**
-- ============================================================
-- pg_cron scheduled jobs for BETK MVP
-- SCHEDULES ARE UTC. pg_cron evaluates the cluster GUC cron.timezone, which on
-- this Supabase cluster is UTC/GMT and is NOT settable persistently via SQL
-- (postmaster-context). The 3 DAILY jobs are therefore stored as UTC-equivalent
-- expressions of their Cairo intent (R3, 2026-07-16, migration
-- 20260716130533_reschedule_daily_cron_utc.sql).
-- Egypt DST: UTC+2 in WINTER (standard), UTC+3 in SUMMER (~Apr-Oct). Each daily
-- job is anchored on standard time (UTC+2) — exact Cairo intent in winter, +1h
-- in summer — and verified to stay in the overnight Cairo window in BOTH seasons.
-- The interval jobs (expire-boosts, dispute-sla-alert, cleanup-otp-tokens) are
-- timezone-independent.
-- ============================================================
-- 1. Expire boost listings every 15 minutes (interval; timezone-independent)
SELECT cron.schedule(
  'expire-boosts',
  '*/15 * * * *',
  $$
    UPDATE betk.boosts
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at < NOW();
  $$
);
-- 2. Nightly seller level recalculation.
--    Intent ~02:00 Cairo. UTC '0 0 * * *' -> WINTER (UTC+2) 02:00 (exact) / SUMMER (UTC+3) 03:00.
SELECT cron.schedule(
  'recalculate-seller-levels',
  '0 0 * * *',
  $$
    UPDATE betk.seller_profiles sp
    SET
      level = CASE
        WHEN sp.total_orders_completed >= 50
          AND (SELECT average_rating FROM betk.rating_aggregates WHERE store_id =
               (SELECT id FROM betk.stores WHERE seller_id = sp.id)) >= 4.5
          THEN 'gold'
        WHEN sp.total_orders_completed >= 10
          AND (SELECT average_rating FROM betk.rating_aggregates WHERE store_id =
               (SELECT id FROM betk.stores WHERE seller_id = sp.id)) >= 4.0
          THEN 'silver'
        ELSE 'bronze'
      END,
      level_score = LEAST(100, (sp.total_orders_completed / 5) + (sp.total_reviews_count * 2))
    WHERE sp.status = 'active';
  $$
);
-- 3. Nightly analytics snapshot.
--    Intent ~00:05 Cairo. UTC '5 22 * * *' -> WINTER (UTC+2) 00:05 (exact) / SUMMER (UTC+3) 01:05.
--    22:05 UTC is within the same UTC calendar day, so CURRENT_DATE-1 accounting is unchanged.
SELECT cron.schedule(
  'daily-platform-snapshot',
  '5 22 * * *',
  $$
    INSERT INTO betk_analytics.platform_snapshots
      (snapshot_date, total_sellers_active, total_buyers,
       new_sellers, new_buyers, gmv_egp,
       orders_created, orders_delivered,
       disputes_opened, disputes_resolved, boost_revenue_egp)
    VALUES (
      CURRENT_DATE - 1,
      (SELECT COUNT(*) FROM betk.seller_profiles WHERE status = 'active'),
      (SELECT COUNT(*) FROM betk.buyer_profiles),
      (SELECT COUNT(*) FROM betk.seller_profiles
       WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.buyer_profiles
       WHERE DATE(id::text::timestamp) = CURRENT_DATE - 1),
      (SELECT COALESCE(SUM(total_amount),0) FROM betk.orders
       WHERE DATE(created_at) = CURRENT_DATE - 1 AND status != 'cancelled'),
      (SELECT COUNT(*) FROM betk.orders WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.orders
       WHERE DATE(delivered_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.disputes WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.disputes
       WHERE DATE(resolved_at) = CURRENT_DATE - 1 AND status = 'resolved'),
      (SELECT COALESCE(SUM(amount_paid),0) FROM betk.boosts
       WHERE DATE(payment_confirmed_at) = CURRENT_DATE - 1)
    ) ON CONFLICT (snapshot_date) DO NOTHING;
  $$
);
-- 4. Alert admin on dispute SLA breach approaching (every hour)
SELECT cron.schedule(
  'dispute-sla-alert',
  '0 * * * *',
  $$
    INSERT INTO betk.notifications (user_id, type, channel, body, data)
    SELECT
      u.id,
      'dispute_sla_warning',
      'sms',
      'BETK Alert: Dispute #' || d.id || ' SLA breaches in 1 hour.',
      jsonb_build_object('dispute_id', d.id, 'order_id', d.order_id)
    FROM betk.disputes d
    JOIN betk.users u ON u.role = 'admin' AND u.status = 'active'
    WHERE d.status NOT IN ('resolved', 'closed')
    AND d.sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '1 hour';
  $$
);
-- 5. Expire temporary suspensions daily.
--    Intent ~03:00 Cairo. UTC '0 1 * * *' -> WINTER (UTC+2) 03:00 (exact) / SUMMER (UTC+3) 04:00.
SELECT cron.schedule(
  'lift-temp-suspensions',
  '0 1 * * *',
  $$
    UPDATE betk.seller_profiles
    SET status = 'active', suspension_ends_at = NULL
    WHERE status = 'suspended'
    AND suspension_ends_at IS NOT NULL
    AND suspension_ends_at < NOW();
    UPDATE betk.users
    SET status = 'active'
    WHERE status = 'suspended'
    AND id IN (
      SELECT id FROM betk.seller_profiles
      WHERE status = 'active'
    );
  $$
);
-- 6. Auto-expire OTP tokens (clean up hourly)
SELECT cron.schedule(
  'cleanup-otp-tokens',
  '30 * * * *',
  $$
    DELETE FROM betk.otp_tokens
    WHERE expires_at < NOW() - INTERVAL '1 hour';
  $$
);

-- ============================================================
-- MVP FREEZE (OD-4): VERIFIED-PHONE TRANSACTION GATE
-- RESTRICTIVE policies are ANDed with the permissive policies above, so a row
-- can be inserted only if the acting user has a verified (non-null) phone_number.
-- This enforces "phone required before transacting" without weakening ownership.
-- Server Actions ALSO enforce this and trigger phone+OTP capture when missing.
-- ============================================================
CREATE POLICY orders_phone_gate ON betk.orders AS RESTRICTIVE FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM betk.users u WHERE u.id = auth.uid() AND u.phone_number IS NOT NULL));
CREATE POLICY seller_profiles_phone_gate ON betk.seller_profiles AS RESTRICTIVE FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM betk.users u WHERE u.id = auth.uid() AND u.phone_number IS NOT NULL));
CREATE POLICY payouts_phone_gate ON betk.payouts AS RESTRICTIVE FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM betk.users u WHERE u.id = auth.uid() AND u.phone_number IS NOT NULL));

-- ============================================================
-- PRE-LAUNCH SECURITY CONDITIONS (Architecture Conversation 3 §8.2 — MANDATORY)
--  1. WhatsApp template change logging + approval workflow (RISK 1).
--  2. CHECK constraints on numeric admin_settings keys, e.g. dispute_sla_hours>0 (RISK 2).
--  3. Trigger validating polymorphic flagged_content.content_id vs content_type (RISK 3).
--  4. Confirm service_role bypasses is_admin()/RLS for pg_cron jobs; test before enabling (RISK 4).
--  5. seller_documents in a PRIVATE Storage bucket; signed URLs <=15 min (RISK 5).
-- These are gates in LAUNCH_CHECKLIST.md. PgBouncer on from day 1; notifications 90-day archive scheduled.
-- ============================================================

-- ============================================================
-- STORAGE (Phase 04 / T01 + T01-FIX) — buckets + storage.objects RLS
-- Migrations 20260719133052_storage_buckets_docs_media_rls.sql +
-- 20260719134903_media_select_own_prefix_rls.sql. Bucket NAMES are
-- configuration, settled with the human (docs / media), read via configs/env.ts
-- (SUPABASE_DOCS_BUCKET / SUPABASE_MEDIA_BUCKET) — never hardcoded in app code.
-- MIME allow-list + size limits are CHOSEN DEFAULTS (SECURITY_GUIDELINES pins
-- only docs-private+signed-URLs / media-public; no numeric limits are specced).
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('docs',  'docs',  false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('media', 'media', true,   5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- docs = PRIVATE (national-ID PII). Own-prefix = first path folder is the owner
-- uid. Admin review = short-lived signed URLs (RISK 5), service-role side.
-- No UPDATE/DELETE policy: resubmission (R-S08/MW2) writes a NEW object under the
-- owner prefix; retaining prior documents is intentional (default-deny backs it).
CREATE POLICY "docs_insert_own_prefix" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "docs_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR betk.is_admin()));

-- media = PUBLIC-read (avatar/cover; listing images in Phase 05). Bucket stays
-- public=true so object URLs serve WITHOUT RLS — that is the app's read path.
-- SELECT is scoped to own-prefix (T01-FIX, migration 20260719134903) so the
-- Data API cannot enumerate the whole bucket; this cleared advisor 0025
-- public_bucket_allows_listing. Mirrors the media INSERT/UPDATE prefix rule.
CREATE POLICY "media_select_own_prefix" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media_insert_own_prefix" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media_update_own_prefix" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- SELLER APPLICATION SUBMIT RPC (Phase 04 / T03, ADR-012)
-- Migration 20260720083710_seller_application_submit_rpc.sql.
-- Atomic multi-table write: seller_profiles + stores + 2 seller_documents in
-- ONE transaction (PostgREST wraps each rpc call in a transaction; any failure
-- rolls back every row -> no partial residue). Chosen over sequential
-- authenticated-client writes with compensating cleanup because seller_profiles
-- has no DELETE policy (compensation would need service-role) and a mid-sequence
-- crash could strand a half-built application.
--
-- SECURITY INVOKER (NOT DEFINER): RLS is NOT bypassed, so the RESTRICTIVE
-- seller_profiles_phone_gate bites naturally (OD-4 / REG-10 at the DB layer with
-- no hand-rolled phone check) and sp_insert / stores_insert / sdoc_own enforce
-- id / seller_id = auth.uid(). A SECURITY DEFINER function granted to
-- authenticated would add advisor 0029 (authenticated_security_definer_function_
-- executable) — forbidden by the "no new advisor findings" bar. The users.role
-- flip is NOT in this function (betk.users has no permissive UPDATE policy) — it
-- runs LAST via the service-role setUserRole() helper after this rpc commits
-- (REG-19; the seller_profiles row provably exists before the flip).
-- ============================================================
CREATE OR REPLACE FUNCTION betk.submit_seller_application(
  p_name_ar             TEXT,
  p_name_en             TEXT,
  p_bio_ar              TEXT,
  p_slug                TEXT,
  p_category_primary    TEXT,
  p_category_secondary  TEXT,
  p_governorate         TEXT,
  p_city                TEXT,
  p_payment_methods     JSONB,
  p_delivery_options    JSONB,
  p_return_policy       TEXT,
  p_min_order_egp       NUMERIC,
  p_doc_front_path      TEXT,
  p_doc_back_path       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = betk, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_constraint TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_NOT_AUTHENTICATED';
  END IF;

  INSERT INTO betk.seller_profiles (id, status, level, submitted_at)
  VALUES (v_uid, 'pending', 'bronze', now());

  INSERT INTO betk.stores (
    seller_id, name_ar, name_en, slug, bio_ar,
    category_primary, category_secondary, governorate, city,
    payment_methods, delivery_options, return_policy, min_order_egp, status
  )
  VALUES (
    v_uid, p_name_ar, p_name_en, p_slug, p_bio_ar,
    p_category_primary, p_category_secondary, p_governorate, p_city,
    COALESCE(p_payment_methods, '{}'::jsonb),
    COALESCE(p_delivery_options, '{}'::jsonb),
    p_return_policy, p_min_order_egp, 'pending'
  );

  INSERT INTO betk.seller_documents (seller_id, document_type, storage_path, review_status)
  VALUES
    (v_uid, 'national_id_front', p_doc_front_path, 'pending'),
    (v_uid, 'national_id_back',  p_doc_back_path,  'pending');

EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'uq_stores_slug' THEN
      RAISE EXCEPTION 'BETK_SLUG_TAKEN';
    ELSIF v_constraint IN ('seller_profiles_pkey', 'uq_stores_seller', 'uq_seller_doc_type') THEN
      RAISE EXCEPTION 'BETK_APPLICATION_EXISTS';
    ELSE
      RAISE;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION betk.submit_seller_application(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION betk.submit_seller_application(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, NUMERIC, TEXT, TEXT
) TO authenticated;

-- ============================================================
-- SELLER APPLICATION RESUBMIT RPC (Phase 04 / T05, ADR-012 pattern)
-- Migration 20260720095552_seller_application_resubmit_rpc.sql.
--
-- CONFIRMED STATE MODEL (T05 citations):
--   * seller_status enum = {pending, active, suspended, banned} ONLY (see the
--     CREATE TYPE above) -- no 'rejected' member, live-verified via pg_enum
--     with zero drift. "Rejected" is therefore the COMPOUND state
--     status='pending' AND rejected_reason IS NOT NULL. BETK_UI_SPEC.md's
--     routing rule ("pending/rejected -> /seller/status", distinct from
--     "suspended/banned -> restricted view") groups pending+rejected into one
--     branch, corroborating this reading independently of the DB. Resubmit
--     therefore does NOT change `status` (it never left 'pending'); it only
--     clears rejected_reason back to NULL and refreshes submitted_at.
--   * seller_documents' UNIQUE (seller_id, document_type) (uq_seller_doc_type
--     above) makes a second per-doc-type INSERT impossible (unique_violation
--     -- the same exception submit_seller_application maps to
--     BETK_APPLICATION_EXISTS). Resubmission therefore UPDATEs the two
--     existing rows in place: overwrite storage_path, reset
--     review_status='pending', clear reviewed_at, refresh uploaded_at.
--   * No DB trigger/constraint governs this transition (live-verified: zero
--     user-defined triggers on seller_profiles/seller_documents/stores) --
--     entirely app-layer, implemented here.
--   * stores.status is NOT touched -- it only ever mirrors seller status at
--     submit time ('pending' literal above) and a rejection never moves
--     seller_profiles.status away from 'pending', so nothing to mirror back.
--   * Storage-OBJECT retention (R-S08) happens at the STORAGE layer (docs
--     bucket has no UPDATE/DELETE policy -- see "docs = PRIVATE" above): each
--     resubmit upload lands at a NEW object path under the same own-prefix;
--     the prior object is intentionally left in place. This rpc only
--     repoints the DB row's storage_path to the new object.
--
-- SECURITY INVOKER: no client-supplied id anywhere -- the function only ever
-- acts on the caller's own auth.uid() rows (sp_update / sdoc_own enforce
-- ownership naturally); cross-user access has no code path to attempt.
-- ============================================================
CREATE OR REPLACE FUNCTION betk.resubmit_seller_application(
  p_doc_front_path TEXT,
  p_doc_back_path  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = betk, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_NOT_AUTHENTICATED';
  END IF;

  -- Rejected-only guard, SERVER-SIDE (never trust the caller): only a row
  -- that is status='pending' AND rejected_reason IS NOT NULL qualifies.
  UPDATE betk.seller_profiles
  SET rejected_reason = NULL,
      submitted_at = now()
  WHERE id = v_uid
    AND status = 'pending'
    AND rejected_reason IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_NOT_REJECTED';
  END IF;

  UPDATE betk.seller_documents
  SET storage_path = p_doc_front_path,
      review_status = 'pending',
      reviewed_at = NULL,
      uploaded_at = now()
  WHERE seller_id = v_uid AND document_type = 'national_id_front';

  UPDATE betk.seller_documents
  SET storage_path = p_doc_back_path,
      review_status = 'pending',
      reviewed_at = NULL,
      uploaded_at = now()
  WHERE seller_id = v_uid AND document_type = 'national_id_back';
END;
$$;
REVOKE ALL ON FUNCTION betk.resubmit_seller_application(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION betk.resubmit_seller_application(TEXT, TEXT) TO authenticated;


-- ============================================================
-- Phase 08 T03 backfill (2026-10-01). Source parity for the three
-- applied migrations. The historical CREATE blocks above stay as landed.
-- ============================================================

-- 20261001091326_v2_08_enum_labels (M1; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M1 v2_08_enum_labels. Plan §6 M1, §1.3, ERD §5.
-- ready is placed after preparing so the label order matches ERD §5.
-- New labels are not used in this migration (Postgres 17).

ALTER TYPE betk.order_status ADD VALUE 'ready' AFTER 'preparing';

ALTER TYPE betk.doc_type ADD VALUE 'food_packaging';
ALTER TYPE betk.doc_type ADD VALUE 'food_label';
ALTER TYPE betk.doc_type ADD VALUE 'food_expiry';
ALTER TYPE betk.doc_type ADD VALUE 'food_social_url';

CREATE TYPE betk.escalation_reason AS ENUM (
  'out_of_stock',
  'damaged',
  'cannot_fulfil',
  'sla_breach'
);

CREATE TYPE betk.return_status AS ENUM (
  'requested',
  'accepted',
  'rejected',
  'refunded'
);

CREATE TYPE betk.agreement_document AS ENUM (
  'buyer_terms',
  'seller_agreement',
  'return_policy',
  'privacy'
);

-- 20261001091538_v2_08_new_tables (M2; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M2 v2_08_new_tables. Plan §6 M2, §1.1–§1.5, ERD §6.1 and §8.
-- Per table: CREATE, ENABLE ROW LEVEL SECURITY, CREATE POLICY, then the
-- grant change past the default ACL (anon loses writes).
-- returns.seller_order_id references betk.orders. M6 renames that relation
-- in place; the foreign key follows the OID (plan §2).

-- DRAFT. Mechanism for the ERD exclusion constraint. Not a new table.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

SET LOCAL search_path TO betk, extensions, public;

CREATE TABLE betk.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  quantity smallint NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  inquiry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id) ON DELETE CASCADE,
  CONSTRAINT cart_items_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES betk.listings (id),
  CONSTRAINT cart_items_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES betk.inquiries (id),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT cart_items_unit_price_check CHECK (unit_price > 0),
  CONSTRAINT chk_cart_item_custom_inquiry CHECK (
    (is_custom = false AND inquiry_id IS NULL)
    OR (is_custom = true AND inquiry_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_cart_items_listing
  ON betk.cart_items (buyer_id, listing_id)
  WHERE inquiry_id IS NULL;

CREATE UNIQUE INDEX uq_cart_items_inquiry
  ON betk.cart_items (buyer_id, inquiry_id)
  WHERE inquiry_id IS NOT NULL;

ALTER TABLE betk.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_items_select ON betk.cart_items
  FOR SELECT
  USING (buyer_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY cart_items_insert ON betk.cart_items
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY cart_items_update ON betk.cart_items
  FOR UPDATE
  USING (buyer_id = (select auth.uid()))
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY cart_items_delete ON betk.cart_items
  FOR DELETE
  USING (buyer_id = (select auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON betk.cart_items FROM anon;

CREATE TABLE betk.master_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  betk_ref varchar(25) NOT NULL,
  delivery_address_id uuid,
  recipient_name varchar(100),
  recipient_phone varchar(15),
  snapshot_governorate varchar(50),
  snapshot_city varchar(100),
  snapshot_street_address text,
  snapshot_building_notes text,
  combined_delivery_total numeric(10,2) NOT NULL,
  proof_path varchar,
  transfer_reference varchar(100),
  proof_uploaded_at timestamptz,
  payment_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_orders_pkey PRIMARY KEY (id),
  CONSTRAINT uq_master_orders_betk_ref UNIQUE (betk_ref),
  CONSTRAINT master_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id),
  CONSTRAINT master_orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES betk.addresses (id),
  CONSTRAINT chk_master_combined_delivery_total CHECK (combined_delivery_total >= 0)
);

ALTER TABLE betk.master_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY master_orders_select ON betk.master_orders
  FOR SELECT
  USING (buyer_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY master_orders_insert ON betk.master_orders
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY master_orders_phone_gate ON betk.master_orders
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.users AS u
      WHERE u.id = (select auth.uid())
        AND u.phone_number IS NOT NULL
    )
  );

CREATE POLICY master_orders_update ON betk.master_orders
  FOR UPDATE
  USING (buyer_id = (select auth.uid()) OR betk.is_admin())
  WITH CHECK (buyer_id = (select auth.uid()) OR betk.is_admin());

REVOKE ALL ON betk.master_orders FROM anon, authenticated;

CREATE TABLE betk.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  store_id uuid NOT NULL,
  reason text NOT NULL,
  status betk.return_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_seller_order_id_fkey FOREIGN KEY (seller_order_id) REFERENCES betk.orders (id),
  CONSTRAINT returns_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id),
  CONSTRAINT returns_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id)
);

ALTER TABLE betk.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY returns_select ON betk.returns
  FOR SELECT
  USING (
    buyer_id = (select auth.uid())
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );

CREATE POLICY returns_insert ON betk.returns
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY returns_update ON betk.returns
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.returns FROM anon;

CREATE TABLE betk.return_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT return_evidence_return_id_fkey FOREIGN KEY (return_id) REFERENCES betk.returns (id) ON DELETE CASCADE
);

ALTER TABLE betk.return_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY return_evidence_select ON betk.return_evidence
  FOR SELECT
  USING (
    betk.is_admin()
    OR EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.id = return_id
        AND (
          r.buyer_id = (select auth.uid())
          OR r.store_id = betk.my_store_id()
        )
    )
  );

CREATE POLICY return_evidence_insert ON betk.return_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.id = return_id
        AND r.buyer_id = (select auth.uid())
    )
  );

REVOKE INSERT, UPDATE, DELETE ON betk.return_evidence FROM anon;

CREATE TABLE betk.agreement_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document betk.agreement_document NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  CONSTRAINT agreement_acceptances_pkey PRIMARY KEY (id),
  CONSTRAINT agreement_acceptances_user_id_fkey FOREIGN KEY (user_id) REFERENCES betk.users (id),
  CONSTRAINT uq_agreement_acceptances_version UNIQUE (user_id, document, version_label),
  CONSTRAINT chk_agreement_acceptance_status CHECK (status = 'accepted')
);

ALTER TABLE betk.agreement_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY agreement_acceptances_select ON betk.agreement_acceptances
  FOR SELECT
  USING (user_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY agreement_acceptances_insert ON betk.agreement_acceptances
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON betk.agreement_acceptances FROM anon;

CREATE TABLE betk.store_categories (
  store_id uuid NOT NULL,
  category_id uuid NOT NULL,
  approved_at timestamptz,
  CONSTRAINT store_categories_pkey PRIMARY KEY (store_id, category_id),
  CONSTRAINT store_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id) ON DELETE CASCADE,
  CONSTRAINT store_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES betk.categories (id)
);

ALTER TABLE betk.store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_categories_select ON betk.store_categories
  FOR SELECT
  TO anon, authenticated
  USING (approved_at IS NOT NULL OR store_id = betk.my_store_id() OR betk.is_admin());

CREATE POLICY store_categories_insert ON betk.store_categories
  FOR INSERT
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

CREATE POLICY store_categories_update ON betk.store_categories
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY store_categories_delete ON betk.store_categories
  FOR DELETE
  USING (store_id = betk.my_store_id() OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.store_categories FROM anon;

CREATE TABLE betk.courier_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  origin_governorate varchar(50) NOT NULL,
  destination_governorate varchar(50) NOT NULL,
  weight_min_g integer NOT NULL,
  weight_max_g integer,
  fee_egp numeric(10,2) NOT NULL,
  CONSTRAINT courier_rates_pkey PRIMARY KEY (id),
  CONSTRAINT uq_courier_rates_band_start UNIQUE (origin_governorate, destination_governorate, weight_min_g),
  CONSTRAINT courier_rates_weight_min_check CHECK (weight_min_g >= 0),
  CONSTRAINT courier_rates_weight_max_check CHECK (weight_max_g IS NULL OR weight_max_g > weight_min_g),
  CONSTRAINT courier_rates_fee_check CHECK (fee_egp >= 0),
  CONSTRAINT courier_rates_no_overlap EXCLUDE USING gist (
    (origin_governorate::text) WITH =,
    (destination_governorate::text) WITH =,
    int4range(weight_min_g, weight_max_g, '[)') WITH &&
  )
);

ALTER TABLE betk.courier_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY courier_rates_select ON betk.courier_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY courier_rates_insert ON betk.courier_rates
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY courier_rates_update ON betk.courier_rates
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY courier_rates_delete ON betk.courier_rates
  FOR DELETE
  USING (betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.courier_rates FROM anon;

CREATE TABLE betk.store_pickup_addresses (
  store_id uuid NOT NULL,
  governorate varchar(50) NOT NULL,
  city varchar(100) NOT NULL,
  street_address text NOT NULL,
  building_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_pickup_addresses_pkey PRIMARY KEY (store_id),
  CONSTRAINT store_pickup_addresses_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id) ON DELETE CASCADE
);

ALTER TABLE betk.store_pickup_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_pickup_addresses_select ON betk.store_pickup_addresses
  FOR SELECT
  USING (store_id = betk.my_store_id() OR betk.is_admin());

CREATE POLICY store_pickup_addresses_insert ON betk.store_pickup_addresses
  FOR INSERT
  WITH CHECK (store_id = betk.my_store_id());

CREATE POLICY store_pickup_addresses_update ON betk.store_pickup_addresses
  FOR UPDATE
  USING (store_id = betk.my_store_id() OR betk.is_admin())
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.store_pickup_addresses FROM anon;

-- 20261001091653_v2_08_additive_columns (M3; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M3 v2_08_additive_columns. Plan §6 M3, §1.2, ERD §6.2 and §6.3.
-- The relation is still betk.orders. M6 renames it.

ALTER TABLE betk.listings
  ADD COLUMN weight_g integer,
  ADD COLUMN length_mm integer,
  ADD COLUMN width_mm integer,
  ADD COLUMN height_mm integer,
  ADD COLUMN specs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN prep_days smallint,
  ADD COLUMN stock_touched_at timestamptz;

ALTER TABLE betk.listings
  ADD CONSTRAINT listings_weight_g_check CHECK (weight_g IS NULL OR weight_g > 0),
  ADD CONSTRAINT listings_length_mm_check CHECK (length_mm IS NULL OR length_mm > 0),
  ADD CONSTRAINT listings_width_mm_check CHECK (width_mm IS NULL OR width_mm > 0),
  ADD CONSTRAINT listings_height_mm_check CHECK (height_mm IS NULL OR height_mm > 0);

-- DRAFT. Phase 08. Do not VALIDATE in this phase.
ALTER TABLE betk.listings
  ADD CONSTRAINT chk_active_listing_shipping
  CHECK (
    status <> 'active'::betk.listing_status
    OR (
      weight_g IS NOT NULL AND length_mm IS NOT NULL
      AND width_mm IS NOT NULL AND height_mm IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE betk.inquiries
  ADD COLUMN quoted_price numeric(10,2),
  ADD COLUMN quoted_prep_days smallint,
  ADD COLUMN quote_expires_at timestamptz,
  ADD COLUMN quoted_at timestamptz;

ALTER TABLE betk.inquiries
  ADD CONSTRAINT inquiries_quoted_price_check CHECK (quoted_price IS NULL OR quoted_price > 0),
  ADD CONSTRAINT inquiries_quoted_prep_days_check CHECK (quoted_prep_days IS NULL OR quoted_prep_days >= 0);

ALTER TABLE betk.order_items
  ADD COLUMN is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN inquiry_id uuid,
  ADD COLUMN prep_days_snapshot smallint;

ALTER TABLE betk.order_items
  ADD CONSTRAINT order_items_inquiry_id_fkey
    FOREIGN KEY (inquiry_id) REFERENCES betk.inquiries (id),
  ADD CONSTRAINT chk_order_item_custom_inquiry
    CHECK (
      (is_custom = false AND inquiry_id IS NULL)
      OR (is_custom = true AND inquiry_id IS NOT NULL)
    );

ALTER TABLE betk.payments
  ADD COLUMN refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN proof_snapshot_at timestamptz;

ALTER TABLE betk.payments
  ADD CONSTRAINT chk_refunded_amount
    CHECK (0 <= refunded_amount AND refunded_amount <= amount);

ALTER TABLE betk.disputes
  ADD COLUMN return_id uuid;

ALTER TABLE betk.disputes
  ADD CONSTRAINT disputes_return_id_fkey
    FOREIGN KEY (return_id) REFERENCES betk.returns (id);

ALTER TABLE betk.orders
  ADD COLUMN master_order_id uuid,
  ADD COLUMN display_ref varchar(64),
  ADD COLUMN courier_rate_id uuid,
  ADD COLUMN prep_deadline timestamptz,
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN escalation_reason betk.escalation_reason,
  ADD COLUMN escalation_note text,
  ADD COLUMN escalation_resolved_at timestamptz,
  ADD COLUMN balance_confirmed_at timestamptz,
  ADD COLUMN refunded_subtotal numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN payout_eligible_at timestamptz;

ALTER TABLE betk.orders
  ADD CONSTRAINT orders_master_order_id_fkey
    FOREIGN KEY (master_order_id) REFERENCES betk.master_orders (id),
  ADD CONSTRAINT orders_courier_rate_id_fkey
    FOREIGN KEY (courier_rate_id) REFERENCES betk.courier_rates (id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_escalation_reason_present
    CHECK ((escalated_at IS NULL) OR (escalation_reason IS NOT NULL)),
  ADD CONSTRAINT chk_refunded_subtotal
    CHECK (0 <= refunded_subtotal AND refunded_subtotal <= subtotal);

CREATE UNIQUE INDEX uq_orders_display_ref
  ON betk.orders (display_ref)
  WHERE display_ref IS NOT NULL;

-- Four keys whose ERD §6.3 text states a default meaning. Nine keys inserted
-- as empty text (D4). Empty means not configured. No placeholder.
INSERT INTO betk.admin_settings (key, value) VALUES
  ('quote_tolerance_multiplier', '2'),
  ('quote_validity_hours', '24'),
  ('prep_cap_days', '3'),
  ('seller_category_limit', '3'),
  ('price_band_min_egp', ''),
  ('price_band_max_egp', ''),
  ('payment_window_minutes', ''),
  ('return_window_hours', ''),
  ('food_requirements', ''),
  ('agreement_buyer_terms_version', ''),
  ('agreement_seller_agreement_version', ''),
  ('agreement_return_policy_version', ''),
  ('agreement_privacy_version', '');

-- 20261002073418_v2_08_detach_stock_on_confirm (M4; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M4 v2_08_detach_stock_on_confirm. Plan §6 M4, §4.2.
-- The function remains until M8. This drops the trigger only.

DROP TRIGGER trg_decrement_stock_on_confirm ON betk.orders;

-- 20261002081523_v2_08_n27_masters (M5; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
CREATE TEMP TABLE n27_bound (
  kind text NOT NULL,
  label text,
  id uuid,
  status text,
  row_md5 text,
  stock_qty integer,
  n integer
);

INSERT INTO n27_bound (kind, id, status) VALUES
  ('target', '81147596-94ee-4a25-b634-34c043409242', 'pending'),
  ('target', 'b327bfb8-f807-418e-9448-1fb645351f3b', 'pending'),
  ('target', '41c5b2c2-e5e0-4a60-9d28-3dc467a23a2a', 'pending'),
  ('target', '02482319-a2a7-4b54-aaf1-8c24b5a95150', 'confirmed'),
  ('target', 'c7ba4f04-eefd-489a-b8de-5daa917e998b', 'confirmed');

INSERT INTO n27_bound (kind, id, status) VALUES
  ('keep', 'e5d776fc-1402-484e-84c4-d2b441f5868f', 'cancelled'),
  ('keep', 'da73deed-0670-4cc7-bccd-064b8d301b6f', 'cancelled');

INSERT INTO n27_bound (kind, id, row_md5) VALUES
  ('history', '10998dd4-4fdf-419e-bf0d-07cfef268042', '357e3f6d12058113ae3d21b5b81929fa'),
  ('history', '062290d1-a3fa-49a9-88ef-aa79015f6720', '7b4f9101c18e69a4be6bef0dfbcb4319'),
  ('history', '4dbddb13-18fa-4327-ac5a-16a7d6e8d9d9', '5b4eabf2b9789ca19fce5fcde28aabed'),
  ('history', '32805669-ec09-47d5-8fdd-185e14d9bda5', 'ca59784dbd81490475bd2b5754c3985a'),
  ('history', 'c9cf09ef-462e-482b-892a-327277a0967d', '37790ab559cdf19c28d27b294773f8a4'),
  ('history', '5c7cd87d-9a09-4819-8217-055e06df0302', 'ceaf82c5ea6811d9b54dad054ce24d2f'),
  ('history', '08b94ebe-06b2-4041-b0e0-2ee6239298e2', 'ac58be52f37544d8460a4661ad996829');

INSERT INTO n27_bound (kind, id, stock_qty) VALUES
  ('listing', '151532d9-f69d-464d-ad8d-741d647c51ae', 50),
  ('listing', '30e7879e-a811-4986-813a-38393f7274be', NULL),
  ('listing', '8edcd182-cc02-4430-ae9a-9049318ca58a', NULL);

INSERT INTO n27_bound (kind, label, n) VALUES
  ('count', 'orders', 7),
  ('count', 'payments', 0),
  ('count', 'items', 0),
  ('count', 'history', 7);
-- <<< STAGING-BOUND LITERALS

-- M5 v2_08_n27_masters. Plan §4.3, §4.6, §4.9, §6 M5.
-- The link updates only master_order_id while trg_enforce_order_transition
-- is still enabled. D1 disables that one trigger around the five updates
-- and five history inserts. Not DISABLE TRIGGER ALL. Not session_replication_role.

DO $n27$
DECLARE
  v_payments integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'payments');
  v_orders integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'orders');
  v_items integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'items');
BEGIN
  IF (SELECT count(*) FROM betk.payments) <> v_payments THEN
    RAISE EXCEPTION 'BETK_N27_PAYMENTS_NONEMPTY';
  END IF;
  IF (SELECT count(*) FROM betk.orders) <> v_orders THEN
    RAISE EXCEPTION 'BETK_N27_ORDER_COUNT';
  END IF;
  IF (SELECT count(*) FROM betk.order_items) <> v_items THEN
    RAISE EXCEPTION 'BETK_N27_ITEMS_NONEMPTY';
  END IF;
  IF (
    SELECT count(*)
    FROM n27_bound AS b
    JOIN betk.orders AS o ON o.id = b.id
    WHERE b.kind = 'target'
      AND o.status::text = b.status
  ) <> 5 THEN
    RAISE EXCEPTION 'BETK_N27_TARGET_STATUS';
  END IF;
END
$n27$;

INSERT INTO betk.master_orders (
  buyer_id,
  delivery_address_id,
  betk_ref,
  combined_delivery_total,
  created_at,
  recipient_name,
  recipient_phone,
  snapshot_governorate,
  snapshot_city,
  snapshot_street_address,
  snapshot_building_notes,
  proof_path,
  transfer_reference,
  proof_uploaded_at,
  payment_deadline
)
SELECT
  o.buyer_id,
  o.delivery_address_id,
  o.betk_ref,
  o.delivery_fee,
  o.created_at,
  NULL,
  NULL,
  a.governorate,
  a.city,
  a.street_address,
  a.building_notes,
  NULL,
  NULL,
  NULL,
  NULL
FROM betk.orders AS o
LEFT JOIN betk.addresses AS a ON a.id = o.delivery_address_id;

UPDATE betk.orders AS o
SET master_order_id = m.id
FROM betk.master_orders AS m
WHERE m.betk_ref = o.betk_ref;

ALTER TABLE betk.orders DISABLE TRIGGER trg_enforce_order_transition;

UPDATE betk.orders AS o
SET status = 'cancelled',
    cancelled_by = 'system'
FROM n27_bound AS b
WHERE b.kind = 'target'
  AND o.id = b.id;

INSERT INTO betk.order_status_history (
  order_id,
  from_status,
  to_status,
  changed_by,
  changed_by_type,
  notes
)
SELECT
  b.id,
  b.status::betk.order_status,
  'cancelled',
  NULL,
  'system',
  'N27: cancelled; zero items and zero payments'
FROM n27_bound AS b
WHERE b.kind = 'target';

ALTER TABLE betk.orders ENABLE TRIGGER trg_enforce_order_transition;

DO $n27_verify$
DECLARE
  v_payments integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'payments');
  v_items integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'items');
  v_history integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'history');
BEGIN
  IF (
    SELECT t.tgenabled
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'orders'
      AND t.tgname = 'trg_enforce_order_transition'
  ) <> 'O' THEN
    RAISE EXCEPTION 'BETK_N27_TRIGGER_NOT_ENABLED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    JOIN betk.order_status_history AS h ON h.id = b.id
    WHERE b.kind = 'history'
      AND md5(
        h.id::text || '|' || COALESCE(h.from_status::text, '') || '|' || h.to_status::text
        || '|' || COALESCE(h.changed_by::text, '') || '|' || COALESCE(h.changed_by_type::text, '')
        || '|' || COALESCE(h.notes, '') || '|' || h.created_at::text
      ) IS DISTINCT FROM b.row_md5
  ) THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_MD5';
  END IF;

  IF (SELECT count(*) FROM betk.order_status_history) <> v_history + 5 THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_COUNT';
  END IF;

  IF (
    SELECT count(*)
    FROM betk.order_status_history AS h
    WHERE NOT EXISTS (
      SELECT 1
      FROM n27_bound AS b
      WHERE b.kind = 'history'
        AND b.id = h.id
    )
  ) <> 5 THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_NEW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    WHERE b.kind = 'target'
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = b.id
          AND h.to_status = 'cancelled'
          AND h.changed_by IS NULL
          AND h.changed_by_type = 'system'
          AND h.notes = 'N27: cancelled; zero items and zero payments'
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'BETK_N27_D1_ROW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    WHERE b.kind = 'keep'
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = b.id
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'BETK_N27_KEEP_HISTORY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    JOIN betk.listings AS l ON l.id = b.id
    WHERE b.kind = 'listing'
      AND l.stock_qty IS DISTINCT FROM b.stock_qty
  ) THEN
    RAISE EXCEPTION 'BETK_N27_STOCK_MOVED';
  END IF;

  IF (SELECT count(*) FROM betk.payments) <> v_payments THEN
    RAISE EXCEPTION 'BETK_N27_PAYMENTS_NONEMPTY';
  END IF;
  IF (SELECT count(*) FROM betk.order_items) <> v_items THEN
    RAISE EXCEPTION 'BETK_N27_ITEMS_NONEMPTY';
  END IF;
END
$n27_verify$;

ALTER TABLE betk.orders ALTER COLUMN master_order_id SET NOT NULL;
ALTER TABLE betk.orders ALTER COLUMN betk_ref DROP NOT NULL;

-- 20261002081631_v2_08_rename_seller_orders (M6; backfilled here for source parity).
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M6 v2_08_rename_seller_orders. Plan §6 M6 and §2.
-- One transaction (the apply wrapper). Rename, then the table-name rewrite,
-- then the cron command, then drop the retired checkout, then create
-- checkout_from_cart and revoke EXECUTE. No GRANT in this migration.

ALTER TABLE betk.orders RENAME TO seller_orders;

CREATE OR REPLACE FUNCTION betk.enforce_payment_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  -- admin-only columns
  IF ( NEW.status IS DISTINCT FROM OLD.status
    OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    OR NEW.notes IS DISTINCT FROM OLD.notes ) THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_PAYMENT_ADMIN_ONLY';
    END IF;
  END IF;
  -- F2: transition legality — the ONLY admitted status change is pending -> confirmed.
  -- refunded/failed belong to Phase 10/14 and are not admitted here.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'confirmed') THEN
      RAISE EXCEPTION 'BETK_ILLEGAL_PAYMENT_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  -- buyer proof attach: own pending deposit row only
  IF ( NEW.proof_path IS DISTINCT FROM OLD.proof_path
    OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference ) THEN
    IF NOT ( OLD.payment_type = 'deposit' AND OLD.status = 'pending'
         AND EXISTS (SELECT 1 FROM betk.seller_orders o WHERE o.id = OLD.order_id AND o.buyer_id = auth.uid()) ) THEN
      RAISE EXCEPTION 'BETK_PAYMENT_PROOF_FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

SELECT cron.schedule(
  'daily-platform-snapshot',
  '5 22 * * *',
  $$
    INSERT INTO betk_analytics.platform_snapshots
      (snapshot_date, total_sellers_active, total_buyers,
       new_sellers, new_buyers, gmv_egp,
       orders_created, orders_delivered,
       disputes_opened, disputes_resolved, boost_revenue_egp)
    VALUES (
      CURRENT_DATE - 1,
      (SELECT COUNT(*) FROM betk.seller_profiles WHERE status = 'active'),
      (SELECT COUNT(*) FROM betk.buyer_profiles),
      (SELECT COUNT(*) FROM betk.seller_profiles
       WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.buyer_profiles
       WHERE DATE(id::text::timestamp) = CURRENT_DATE - 1),
      (SELECT COALESCE(SUM(total_amount),0) FROM betk.seller_orders
       WHERE DATE(created_at) = CURRENT_DATE - 1 AND status != 'cancelled'),
      (SELECT COUNT(*) FROM betk.seller_orders WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.seller_orders
       WHERE DATE(delivered_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.disputes WHERE DATE(created_at) = CURRENT_DATE - 1),
      (SELECT COUNT(*) FROM betk.disputes
       WHERE DATE(resolved_at) = CURRENT_DATE - 1 AND status = 'resolved'),
      (SELECT COALESCE(SUM(amount_paid),0) FROM betk.boosts
       WHERE DATE(payment_confirmed_at) = CURRENT_DATE - 1)
    ) ON CONFLICT (snapshot_date) DO NOTHING;
  $$
);

DROP FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method);

-- C1 (human, 2026-09-26). Fail-closed shell with the final signature.
-- Body is the single RAISE. T05b authors the real body. M8 CREATE OR REPLACE
-- lands it (plan §6 M8). The T02 body is drafts/checkout_from_cart.draft.sql.
CREATE FUNCTION betk.checkout_from_cart(p_delivery_address_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'BETK_CHECKOUT_NOT_READY';
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_from_cart(uuid) FROM PUBLIC, anon, authenticated;


-- 20261003075902_v2_08_grants_and_policies (M7; backfilled here for source parity).

-- M7 v2_08_grants_and_policies. Plan §1.5, §1.6, §1.8, §6 M7.
-- Column-scoped tables: REVOKE the table privilege, then GRANT columns
-- (pack §2; E1). A later GRANT is not a substitute for that REVOKE.
-- §1.8 storage: no statement. docs_select_own_or_admin stays (plan §1.8).
-- Last statement: GRANT EXECUTE ON checkout_from_cart TO authenticated.

-- seller_orders SELECT list generated 2026-10-02 from staging
-- information_schema.columns (seller_orders, ordinal_position), minus
-- delivery_fee and total_amount (ADR-020, REG-90, plan §1.6, §6 M7).
-- id, betk_ref, buyer_id, store_id, inquiry_id, delivery_address_id,
-- delivery_method, subtotal, status, cancelled_by, cancellation_reason,
-- notes, created_at, confirmed_at, delivered_at, commission_rate,
-- commission_amount, master_order_id, display_ref, courier_rate_id,
-- prep_deadline, escalated_at, escalation_reason, escalation_note,
-- escalation_resolved_at, balance_confirmed_at, refunded_subtotal,
-- payout_eligible_at.

REVOKE SELECT ON TABLE betk.seller_orders FROM anon, authenticated;

GRANT SELECT (
  id,
  betk_ref,
  buyer_id,
  store_id,
  inquiry_id,
  delivery_address_id,
  delivery_method,
  subtotal,
  status,
  cancelled_by,
  cancellation_reason,
  notes,
  created_at,
  confirmed_at,
  delivered_at,
  commission_rate,
  commission_amount,
  master_order_id,
  display_ref,
  courier_rate_id,
  prep_deadline,
  escalated_at,
  escalation_reason,
  escalation_note,
  escalation_resolved_at,
  balance_confirmed_at,
  refunded_subtotal,
  payout_eligible_at
) ON TABLE betk.seller_orders TO authenticated;

-- authenticated UPDATE stays column-narrow (plan §1.6). Keep status and
-- cancellation_reason. Add the three escalation columns ERD §8 / UI P39
-- name. Do not grant the trigger-stamped or hidden columns.
REVOKE UPDATE ON TABLE betk.seller_orders FROM authenticated;

GRANT UPDATE (
  status,
  cancellation_reason,
  escalated_at,
  escalation_reason,
  escalation_note
) ON TABLE betk.seller_orders TO authenticated;

-- anon table-level UPDATE on seller_orders stays (plan §1.6, ADR-019).
-- No TO public UPDATE policy is added.

-- payments authenticated UPDATE (ADR-021, plan §1.6): drop proof columns,
-- keep the admin columns, add refunded_amount. proof_snapshot_at stays
-- ungranted (trigger-stamped). anon table-level UPDATE stays.
REVOKE UPDATE ON TABLE betk.payments FROM authenticated;

GRANT UPDATE (
  status,
  confirmed_at,
  confirmed_by,
  notes,
  refunded_amount
) ON TABLE betk.payments TO authenticated;

-- master_orders (E1, plan §1.6). M2 already revoked the table privilege.
-- Revoke again so this migration does not depend on that earlier statement
-- being the only closer. anon receives nothing.
REVOKE ALL ON TABLE betk.master_orders FROM anon, authenticated;

GRANT SELECT (
  id,
  buyer_id,
  betk_ref,
  delivery_address_id,
  recipient_name,
  recipient_phone,
  snapshot_governorate,
  snapshot_city,
  snapshot_street_address,
  snapshot_building_notes,
  combined_delivery_total,
  proof_path,
  transfer_reference,
  proof_uploaded_at,
  payment_deadline,
  created_at
) ON TABLE betk.master_orders TO authenticated;

-- INSERT = the columns checkout_from_cart writes (plan §1.6 "checkout
-- columns"). Proof columns are the later UPDATE, not this INSERT.
-- id and created_at keep their defaults and are not in the list.
GRANT INSERT (
  buyer_id,
  betk_ref,
  delivery_address_id,
  recipient_name,
  recipient_phone,
  snapshot_governorate,
  snapshot_city,
  snapshot_street_address,
  snapshot_building_notes,
  combined_delivery_total,
  payment_deadline
) ON TABLE betk.master_orders TO authenticated;

GRANT UPDATE (
  proof_path,
  transfer_reference
) ON TABLE betk.master_orders TO authenticated;

-- dispute_messages read receipt (ERD §8, REG-42 shape). Table UPDATE is
-- revoked before the column GRANT. Sender content stays ungranted
-- ("no MVP surface" on the inquiry_messages row this cell copies).
REVOKE UPDATE ON TABLE betk.dispute_messages FROM anon, authenticated;

GRANT UPDATE (is_read) ON TABLE betk.dispute_messages TO authenticated;

-- Policy rewrites (plan §1.5). Replaced policies use (SELECT auth.uid()).
-- order_messages_* keeps the store leg and is not recreated.
-- sessions and otp_tokens stay zero policies. modlog_admin_insert is not
-- added again.

DROP POLICY orders_access ON betk.seller_orders;
CREATE POLICY orders_access ON betk.seller_orders
  FOR SELECT
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  );

DROP POLICY orders_update ON betk.seller_orders;
CREATE POLICY orders_update ON betk.seller_orders
  FOR UPDATE
  TO authenticated
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  )
  WITH CHECK (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  );

DROP POLICY payments_access ON betk.payments;
CREATE POLICY payments_access ON betk.payments
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1
        FROM betk.seller_orders AS o
        WHERE o.id = payments.order_id
          AND o.buyer_id = (SELECT auth.uid())
      )
    )
    OR betk.is_admin()
  );

DROP POLICY shipments_access ON betk.shipments;
CREATE POLICY shipments_access ON betk.shipments
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1
        FROM betk.seller_orders AS o
        WHERE o.id = shipments.order_id
          AND o.buyer_id = (SELECT auth.uid())
      )
    )
    OR betk.is_admin()
  );

-- ERD §8 shipments INSERT = checkout. Not live before M7 (plan §1.5).
CREATE POLICY shipments_insert ON betk.shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.seller_orders AS o
      WHERE o.id = shipments.order_id
        AND o.buyer_id = (SELECT auth.uid())
    )
  );

-- ERD §8 shipments UPDATE = admin.
CREATE POLICY shipments_update ON betk.shipments
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

DROP POLICY shipment_tracking_events_access ON betk.shipment_tracking_events;
CREATE POLICY shipment_tracking_events_access ON betk.shipment_tracking_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.shipments AS s
      JOIN betk.seller_orders AS o ON o.id = s.order_id
      WHERE s.id = shipment_tracking_events.shipment_id
        AND (
          o.buyer_id = (SELECT auth.uid())
          OR betk.is_admin()
        )
    )
  );

-- ERD §8 tracking INSERT = admin or service. Service role bypasses RLS.
CREATE POLICY shipment_tracking_events_insert ON betk.shipment_tracking_events
  FOR INSERT
  WITH CHECK (betk.is_admin());

DROP POLICY settings_payment_config_read ON betk.admin_settings;
CREATE POLICY settings_payment_config_read ON betk.admin_settings
  FOR SELECT
  TO authenticated
  USING (
    (key)::text = ANY (
      (ARRAY['betk_instapay_handle'::character varying])::text[]
    )
  );

-- Six formerly zero-policy tables (plan §1.5, ERD §8). Not sessions.
-- Not otp_tokens.

CREATE POLICY dispute_evidence_select ON betk.dispute_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_evidence.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_evidence_insert ON betk.dispute_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_evidence.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_select ON betk.dispute_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_insert ON betk.dispute_messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_read_receipt ON betk.dispute_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  )
  WITH CHECK (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY flagged_content_select ON betk.flagged_content
  FOR SELECT
  USING (betk.is_admin());

CREATE POLICY flagged_content_insert ON betk.flagged_content
  FOR INSERT
  WITH CHECK (reported_by = (SELECT auth.uid()));

CREATE POLICY flagged_content_update ON betk.flagged_content
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY restock_alerts_select ON betk.restock_alerts
  FOR SELECT
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR betk.is_admin()
  );

CREATE POLICY restock_alerts_insert ON betk.restock_alerts
  FOR INSERT
  WITH CHECK (buyer_id = (SELECT auth.uid()));

CREATE POLICY restock_alerts_delete ON betk.restock_alerts
  FOR DELETE
  USING (buyer_id = (SELECT auth.uid()));

-- seller_strikes.seller_id references seller_profiles.id, and that id
-- references users.id (schema C1). Own seller is that id.
CREATE POLICY seller_strikes_select ON betk.seller_strikes
  FOR SELECT
  USING (
    (seller_id = (SELECT auth.uid()))
    OR betk.is_admin()
  );

CREATE POLICY seller_strikes_insert ON betk.seller_strikes
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY seller_strikes_update ON betk.seller_strikes
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY whatsapp_templates_select ON betk.whatsapp_templates
  FOR SELECT
  USING (betk.is_admin());

CREATE POLICY whatsapp_templates_insert ON betk.whatsapp_templates
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY whatsapp_templates_update ON betk.whatsapp_templates
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

-- Plan §6 M7 last statement. Not anon. Not PUBLIC.
GRANT EXECUTE ON FUNCTION betk.checkout_from_cart(uuid) TO authenticated;


-- 20261003082041_v2_08_functions (M8; backfilled here for source parity).

-- M8 v2_08_functions. Plan §1.7 and §6 M8.
-- checkout_from_cart replaces the M6 shell (C1, CREATE OR REPLACE).
-- CF-3: ADR-023 on pickup writes and on stores.governorate updates.
-- CF-4: drop trg_set_inquiry_converted_order and set_inquiry_converted_order
-- last. The column and fk_inquiries_order stay. create_order_from_inquiry
-- is already gone (M6) and is not recreated.
--
-- FLAGS (spec does not decide these). G3, below, is the fail-closed rule.
-- FLAG-REG-88. Agreement keys are read and not branched. Plan §8.2.5:
-- if the pin includes the document, empty fails closed; if it excludes the
-- document, checkout does not consult the key. REG-88 is not pinned.
-- FLAG-SUBMIT. submit_seller_application / resubmit_seller_application are
-- not rewritten. D3 names category text as the source of store_categories
-- and does not pin the match to categories.id (name_ar, name_en, or slug).
-- FLAG-REFUND. D2 says the admin supplies the goods portion and the trigger
-- must not copy payments.refunded_amount. No second input column exists.
-- refunded_subtotal is not written.
-- G3 (human, 2026-10-02). The payout cap excludes a seller order that
-- has a dispute or a return whose status is not closed, resolved,
-- rejected, refunded, or cancelled. Live labels (SELECT 2026-10-02):
-- dispute_status submitted, under_review, awaiting_seller, resolved,
-- closed; return_status requested, accepted, rejected, refunded.
-- Terminal among those: dispute resolved and closed; return rejected
-- and refunded. accepted blocks. cancelled is in neither enum. Which
-- of those should block is a product pin (REG minted with this fix).
-- FLAG-COURIER. courier_rates has no courier-name column (ERD §6.1).
-- shipments.courier is set to the matched rate id text. courier_rate_id
-- stores the same id (ERD §6.2).
-- FLAG-PREDELIVERY. "pre-delivery" is not a list. Restore runs from
-- pending, confirmed, preparing, or ready. Not from dispatched.
-- FLAG-RETURN-ACTOR. ERD §7.1 says delivered → returned is "return
-- accepted" and does not name the role. The transition requires an
-- accepted returns row and is_admin().
-- FLAG-PREP-NULL. prep_deadline stays null when every item prep snapshot
-- is null. Zero days is not assumed.
-- FLAG-QUOTE-HOURS. Checkout refuses a custom line whose quote_expires_at
-- is null or not in the future. It does not re-read quote_validity_hours
-- (that key's consumer in §8.2.5 is quote send).
--
-- AUTHORED settings readers. checkout_from_cart is SECURITY INVOKER
-- (plan §1.7). payment_window_minutes, quote_tolerance_multiplier, and the
-- four agreement keys are admin-only (REG-69, plan §8.2.5), so an INVOKER
-- read sees no row. The three DEFINER functions below are the commission-
-- snapshot pattern (ERD §7 set_order_commission_snapshot): the INVOKER
-- body calls them, they read one pinned key, EXECUTE is granted to
-- authenticated and revoked from PUBLIC and anon.

CREATE OR REPLACE FUNCTION betk.checkout_payment_window_minutes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'payment_window_minutes';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_PAYMENT_WINDOW_UNCONFIGURED';
  END IF;
  RETURN btrim(v_raw)::integer;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_payment_window_minutes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_payment_window_minutes() TO authenticated;

CREATE OR REPLACE FUNCTION betk.checkout_quote_multiplier()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'quote_tolerance_multiplier';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[0-9]+(\.[0-9]+)?$' OR btrim(v_raw)::numeric <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_BAND_UNCONFIGURED';
  END IF;
  RETURN btrim(v_raw)::numeric;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_quote_multiplier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_quote_multiplier() TO authenticated;

CREATE OR REPLACE FUNCTION betk.checkout_agreement_version(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  IF p_key NOT IN (
    'agreement_buyer_terms_version',
    'agreement_seller_agreement_version',
    'agreement_return_policy_version',
    'agreement_privacy_version'
  ) THEN
    RAISE EXCEPTION 'BETK_AGREEMENT_KEY_NOT_CHECKOUT';
  END IF;
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = p_key;
  RETURN v_raw;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_agreement_version(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_agreement_version(text) TO authenticated;

-- touch_stock. Plan §1.7. INVOKER. Stamps stock_touched_at when stock_qty
-- changes. Checkout does not set that column itself.
CREATE OR REPLACE FUNCTION betk.touch_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
    NEW.stock_touched_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.touch_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_touch_stock ON betk.listings;
CREATE TRIGGER trg_touch_stock
  BEFORE UPDATE OF stock_qty ON betk.listings
  FOR EACH ROW
  EXECUTE FUNCTION betk.touch_stock();

-- decrement_stock_on_confirm rework (plan §1.7, §7.2 / ERD §7.2).
-- The confirm trigger stays dropped (M4). This body runs from the
-- order_items INSERT trigger so the INVOKER checkout does not UPDATE
-- listings and does not need EXECUTE on this function (ADR-012 revoke
-- already applied; CREATE OR REPLACE keeps it).
CREATE OR REPLACE FUNCTION betk.decrement_stock_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_stock integer;
  v_status betk.listing_status;
BEGIN
  SELECT l.stock_qty, l.status
    INTO v_stock, v_status
  FROM betk.listings AS l
  WHERE l.id = NEW.listing_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_LISTING_MISSING';
  END IF;
  IF v_stock IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_OUT_OF_STOCK';
  END IF;
  UPDATE betk.listings
  SET stock_qty = v_stock - NEW.quantity,
      status = CASE
        WHEN v_stock - NEW.quantity = 0 AND v_status = 'active'
        THEN 'sold_out'::betk.listing_status
        ELSE v_status
      END,
      updated_at = now()
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_checkout ON betk.order_items;
CREATE TRIGGER trg_decrement_stock_on_checkout
  AFTER INSERT ON betk.order_items
  FOR EACH ROW
  EXECUTE FUNCTION betk.decrement_stock_on_confirm();

-- enforce_order_transition rework. ERD §7.1. is_admin() is an actor check
-- on the admin rows of that table, not a bypass of it. Seller is never
-- stamped as cancelled_by. buyer_id is not dropped.
CREATE OR REPLACE FUNCTION betk.enforce_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_proof text;
  v_deadline timestamptz;
  v_hold text;
  v_hold_hours integer;
BEGIN
  IF NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
     OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
    IF NEW.status IS DISTINCT FROM 'cancelled'::betk.order_status
       OR OLD.status = 'cancelled'::betk.order_status THEN
      RAISE EXCEPTION 'BETK_CANCEL_METADATA_FORBIDDEN';
    END IF;
  END IF;

  -- G1 (human, 2026-10-02). The three seller escalation columns, even
  -- when status is unchanged. escalation_resolved_at is absent from the
  -- authenticated UPDATE grant (M7), so a seller write of it is 42501.
  IF NEW.escalated_at IS DISTINCT FROM OLD.escalated_at
     OR NEW.escalation_reason IS DISTINCT FROM OLD.escalation_reason
     OR NEW.escalation_note IS DISTINCT FROM OLD.escalation_note THEN
    IF NEW.store_id IS DISTINCT FROM betk.my_store_id()
       AND NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ESCALATION_ACTOR';
    END IF;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT m.proof_path, m.payment_deadline
    INTO v_proof, v_deadline
  FROM betk.master_orders AS m
  WHERE m.id = OLD.master_order_id;

  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    IF auth.uid() IS NOT NULL AND OLD.buyer_id = auth.uid() THEN
      IF v_proof IS NOT NULL THEN
        RAISE EXCEPTION 'BETK_ORDER_CANCEL_AFTER_PROOF';
      END IF;
      NEW.cancelled_by := 'buyer';
    ELSIF auth.uid() IS NULL
          AND v_proof IS NULL
          AND v_deadline IS NOT NULL
          AND now() >= v_deadline THEN
      NEW.cancelled_by := 'system';
    ELSIF betk.is_admin() AND v_proof IS NOT NULL THEN
      NEW.cancelled_by := 'admin';
    ELSE
      RAISE EXCEPTION 'BETK_ORDER_CANCEL_FORBIDDEN';
    END IF;
  ELSIF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_RELEASE_ADMIN_ONLY';
    END IF;
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
  ELSIF OLD.status = 'confirmed' AND NEW.status = 'preparing' THEN
    IF OLD.store_id IS DISTINCT FROM betk.my_store_id() THEN
      RAISE EXCEPTION 'BETK_ORDER_PREPARING_STORE_ONLY';
    END IF;
  ELSIF OLD.status = 'preparing' AND NEW.status = 'ready' THEN
    IF OLD.store_id IS DISTINCT FROM betk.my_store_id() THEN
      RAISE EXCEPTION 'BETK_ORDER_READY_STORE_ONLY';
    END IF;
  ELSIF OLD.status = 'ready' AND NEW.status = 'dispatched' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_DISPATCH_ADMIN_ONLY';
    END IF;
  ELSIF OLD.status = 'dispatched' AND NEW.status = 'delivered' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_DELIVER_ADMIN_ONLY';
    END IF;
    SELECT value INTO v_hold
    FROM betk.admin_settings
    WHERE key = 'return_hold_hours';
    IF v_hold IS NULL OR btrim(v_hold) !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'BETK_RETURN_HOLD_UNCONFIGURED';
    END IF;
    v_hold_hours := btrim(v_hold)::integer;
    NEW.delivered_at := now();
    NEW.payout_eligible_at := now() + make_interval(hours => v_hold_hours);
  ELSIF OLD.status IN ('confirmed', 'preparing') AND NEW.status = 'cancelled' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_NOT_CANCELLABLE';
    END IF;
    NEW.cancelled_by := 'admin';
  ELSIF OLD.status = 'delivered' AND NEW.status = 'returned' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_RETURN_ADMIN_ONLY';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.seller_order_id = OLD.id
        AND r.status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'BETK_RETURN_NOT_ACCEPTED';
    END IF;
  ELSE
    RAISE EXCEPTION 'BETK_ILLEGAL_ORDER_TRANSITION: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$;

-- release_seller_orders. Plan §1.7. One admin deposit confirm releases
-- every pending child of that master and copies the master proof onto
-- each other deposit row (ADR-021). EXECUTE revoked.
CREATE OR REPLACE FUNCTION betk.release_seller_orders(p_master_id uuid, p_skip_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_proof text;
  v_reference text;
BEGIN
  SELECT proof_path, transfer_reference
    INTO v_proof, v_reference
  FROM betk.master_orders
  WHERE id = p_master_id;

  PERFORM set_config('betk.internal_release', '1', true);

  UPDATE betk.payments AS p
  SET proof_path = v_proof,
      transfer_reference = v_reference,
      proof_snapshot_at = now(),
      status = 'confirmed',
      confirmed_at = COALESCE(p.confirmed_at, now()),
      confirmed_by = COALESCE(p.confirmed_by, auth.uid())
  WHERE p.payment_type = 'deposit'
    AND p.id IS DISTINCT FROM p_skip_payment_id
    AND p.order_id IN (
      SELECT s.id
      FROM betk.seller_orders AS s
      WHERE s.master_order_id = p_master_id
    );

  UPDATE betk.seller_orders AS s
  SET status = 'confirmed',
      confirmed_at = now(),
      prep_deadline = (
        SELECT now() + make_interval(days => mx.d)
        FROM (
          SELECT max(i.prep_days_snapshot)::integer AS d
          FROM betk.order_items AS i
          WHERE i.order_id = s.id
        ) AS mx
        WHERE mx.d IS NOT NULL
      )
  WHERE s.master_order_id = p_master_id
    AND s.status = 'pending';

  PERFORM set_config('betk.internal_release', '', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.release_seller_orders(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- enforce_payment_update full rework (plan §1.7, ADR-021, D2).
-- Buyer cannot write child proof. On admin deposit confirm, copy the
-- master proof onto this row and call release_seller_orders.
-- On balance confirm, stamp balance_confirmed_at only.
-- FLAG-REFUND: refunded_subtotal is not written.
CREATE OR REPLACE FUNCTION betk.enforce_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_master_id uuid;
  v_proof text;
  v_reference text;
BEGIN
  IF current_setting('betk.internal_release', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount
     OR NEW.proof_snapshot_at IS DISTINCT FROM OLD.proof_snapshot_at THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_PAYMENT_ADMIN_ONLY';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'confirmed') THEN
      RAISE EXCEPTION 'BETK_ILLEGAL_PAYMENT_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.proof_path IS DISTINCT FROM OLD.proof_path
     OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference THEN
    RAISE EXCEPTION 'BETK_PAYMENT_PROOF_FORBIDDEN';
  END IF;

  IF OLD.payment_type = 'deposit'
     AND OLD.status = 'pending'
     AND NEW.status = 'confirmed' THEN
    SELECT m.id, m.proof_path, m.transfer_reference
      INTO v_master_id, v_proof, v_reference
    FROM betk.seller_orders AS s
    JOIN betk.master_orders AS m ON m.id = s.master_order_id
    WHERE s.id = OLD.order_id;
    NEW.proof_path := v_proof;
    NEW.transfer_reference := v_reference;
    NEW.proof_snapshot_at := now();
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
    IF NEW.confirmed_by IS NULL THEN
      NEW.confirmed_by := auth.uid();
    END IF;
    PERFORM betk.release_seller_orders(v_master_id, OLD.id);
  ELSIF OLD.payment_type = 'balance'
        AND OLD.status = 'pending'
        AND NEW.status = 'confirmed' THEN
    UPDATE betk.seller_orders
    SET balance_confirmed_at = now()
    WHERE id = OLD.order_id
      AND balance_confirmed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- restore_stock_on_cancel. Plan §1.7, ERD §7, REG-82. Not on returned.
-- FLAG-PREDELIVERY: pending, confirmed, preparing, ready.
CREATE OR REPLACE FUNCTION betk.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.status <> 'cancelled'::betk.order_status
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR OLD.status NOT IN (
       'pending'::betk.order_status,
       'confirmed'::betk.order_status,
       'preparing'::betk.order_status,
       'ready'::betk.order_status
     ) THEN
    RETURN NEW;
  END IF;

  UPDATE betk.listings AS l
  SET stock_qty = l.stock_qty + agg.qty,
      status = CASE
        WHEN l.status = 'sold_out'::betk.listing_status
             AND l.stock_qty + agg.qty > 0
        THEN 'active'::betk.listing_status
        ELSE l.status
      END,
      updated_at = now()
  FROM (
    SELECT i.listing_id, sum(i.quantity)::integer AS qty
    FROM betk.order_items AS i
    WHERE i.order_id = NEW.id
    GROUP BY i.listing_id
  ) AS agg
  WHERE l.id = agg.listing_id
    AND l.stock_qty IS NOT NULL;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  )
  SELECT NEW.buyer_id, i.listing_id, i.quantity, i.unit_price, false, NULL
  FROM betk.order_items AS i
  WHERE i.order_id = NEW.id
    AND i.inquiry_id IS NULL;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  )
  SELECT NEW.buyer_id, i.listing_id, i.quantity, i.unit_price, true, i.inquiry_id
  FROM betk.order_items AS i
  JOIN betk.inquiries AS q ON q.id = i.inquiry_id
  WHERE i.order_id = NEW.id
    AND i.inquiry_id IS NOT NULL
    AND q.quote_expires_at > now();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.restore_stock_on_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON betk.seller_orders;
CREATE TRIGGER trg_restore_stock_on_cancel
  AFTER UPDATE OF status ON betk.seller_orders
  FOR EACH ROW
  EXECUTE FUNCTION betk.restore_stock_on_cancel();

-- enforce_store_category_cap. Plan §1.7. Empty seller_category_limit
-- fails closed (plan §8.2.5 shape: empty is not unlimited).
CREATE OR REPLACE FUNCTION betk.enforce_store_category_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'seller_category_limit';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_CATEGORY_LIMIT_UNCONFIGURED';
  END IF;
  v_limit := btrim(v_raw)::integer;
  SELECT count(*)::integer INTO v_count
  FROM betk.store_categories
  WHERE store_id = NEW.store_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'BETK_STORE_CATEGORY_CAP';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_store_category_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_store_category_cap ON betk.store_categories;
CREATE TRIGGER trg_enforce_store_category_cap
  BEFORE INSERT ON betk.store_categories
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_store_category_cap();

-- Payout INSERT cap. ERD §6.4. G3: a non-terminal dispute or return
-- drops that seller order from the sum. rejected payouts are not
-- "requested or processed".
CREATE OR REPLACE FUNCTION betk.enforce_payout_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_available numeric(10,2);
  v_used numeric(10,2);
BEGIN
  SELECT COALESCE(sum(s.subtotal - COALESCE(s.commission_amount, 0) - s.refunded_subtotal), 0)
    INTO v_available
  FROM betk.seller_orders AS s
  WHERE s.store_id = NEW.store_id
    AND s.balance_confirmed_at IS NOT NULL
    AND s.payout_eligible_at <= now()
    AND NOT EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.order_id = s.id
        AND d.status::text NOT IN (
          'closed', 'resolved', 'rejected', 'refunded', 'cancelled'
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.seller_order_id = s.id
        AND r.status::text NOT IN (
          'closed', 'resolved', 'rejected', 'refunded', 'cancelled'
        )
    );

  SELECT COALESCE(sum(p.amount), 0)
    INTO v_used
  FROM betk.payouts AS p
  WHERE p.store_id = NEW.store_id
    AND p.status IN ('pending', 'processing', 'processed');

  IF NEW.amount > v_available - v_used THEN
    RAISE EXCEPTION 'BETK_PAYOUT_CAP';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_payout_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_payout_cap ON betk.payouts;
CREATE TRIGGER trg_enforce_payout_cap
  BEFORE INSERT ON betk.payouts
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_payout_cap();

-- ADR-023 / CF-3. Pickup writes must already equal stores.governorate.
-- A store governorate update copies onto the pickup row (AFTER, so the
-- pickup trigger reads the new store value).
CREATE OR REPLACE FUNCTION betk.enforce_pickup_governorate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_gov character varying(50);
BEGIN
  SELECT governorate INTO v_gov
  FROM betk.stores
  WHERE id = NEW.store_id;
  IF v_gov IS DISTINCT FROM NEW.governorate THEN
    RAISE EXCEPTION 'BETK_PICKUP_GOVERNORATE_MISMATCH';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_pickup_governorate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pickup_governorate_eq ON betk.store_pickup_addresses;
CREATE TRIGGER trg_pickup_governorate_eq
  BEFORE INSERT OR UPDATE ON betk.store_pickup_addresses
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_pickup_governorate();

CREATE OR REPLACE FUNCTION betk.sync_store_governorate_to_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.governorate IS DISTINCT FROM OLD.governorate THEN
    UPDATE betk.store_pickup_addresses
    SET governorate = NEW.governorate
    WHERE store_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.sync_store_governorate_to_pickup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_store_governorate_eq ON betk.stores;
CREATE TRIGGER trg_store_governorate_eq
  AFTER UPDATE OF governorate ON betk.stores
  FOR EACH ROW
  EXECUTE FUNCTION betk.sync_store_governorate_to_pickup();

-- enforce_master_proof_update. Plan §1.7, ERD §7. Buyer, once, before
-- payment_deadline, while every child is pending. Stamps proof_uploaded_at.
CREATE OR REPLACE FUNCTION betk.enforce_master_proof_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.proof_path IS NOT DISTINCT FROM OLD.proof_path
     AND NEW.transfer_reference IS NOT DISTINCT FROM OLD.transfer_reference THEN
    RETURN NEW;
  END IF;

  IF OLD.proof_path IS NOT NULL
     OR OLD.transfer_reference IS NOT NULL
     OR OLD.proof_uploaded_at IS NOT NULL THEN
    RAISE EXCEPTION 'BETK_PROOF_ALREADY_SET';
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'BETK_PROOF_FORBIDDEN';
  END IF;

  IF NEW.proof_path IS NULL OR NEW.transfer_reference IS NULL THEN
    RAISE EXCEPTION 'BETK_PROOF_INCOMPLETE';
  END IF;

  IF OLD.payment_deadline IS NULL OR now() >= OLD.payment_deadline THEN
    RAISE EXCEPTION 'BETK_PROOF_DEADLINE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.seller_orders AS s
    WHERE s.master_order_id = OLD.id
      AND s.status IS DISTINCT FROM 'pending'::betk.order_status
  ) THEN
    RAISE EXCEPTION 'BETK_PROOF_CHILDREN_NOT_PENDING';
  END IF;

  NEW.proof_uploaded_at := now();
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_master_proof_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_master_proof_update ON betk.master_orders;
CREATE TRIGGER trg_enforce_master_proof_update
  BEFORE UPDATE ON betk.master_orders
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_master_proof_update();

-- checkout_from_cart. Same signature as the M6 shell (C1).
-- Stock: order_items INSERT fires decrement_stock_on_confirm, which
-- updates stock_qty; trg_touch_stock stamps stock_touched_at.
-- betk_ref: BETK-YYYYMMDD-XXXX (R-O02, ERD §6.1 master). Child betk_ref
-- and display_ref stay NULL (REG-81, plan §1.7).
-- Payments: R-O17 two obligations per seller order; ADR-022 one master
-- deposit allocated across child deposit rows; balance method cod.
-- A non-positive amount is not inserted (payments.amount > 0).
-- Hidden columns are INSERT targets from locals. They are not selected
-- and not returned (CF-2).
CREATE OR REPLACE FUNCTION betk.checkout_from_cart(p_delivery_address_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_minutes integer;
  v_mult numeric;
  v_terms text;
  v_seller_agreement text;
  v_return_policy text;
  v_privacy text;
  v_gov character varying(50);
  v_city character varying(100);
  v_street text;
  v_notes text;
  v_master_id uuid;
  v_ref text;
  v_attempt integer := 0;
  v_ids uuid[] := '{}';
  v_stores uuid[] := '{}';
  v_weights integer[] := '{}';
  v_subs numeric[] := '{}';
  v_fees numeric[] := '{}';
  v_rates uuid[] := '{}';
  v_child numeric[] := '{}';
  v_deposit numeric[] := '{}';
  v_balance numeric[] := '{}';
  v_floor numeric[] := '{}';
  v_master_total numeric(10,2);
  v_fee_total numeric(10,2);
  v_floor_sum numeric(10,2) := 0;
  v_master_deposit numeric(10,2);
  v_leftover integer;
  v_ranked uuid[];
  v_extra uuid[] := '{}';
  v_one_rate uuid;
  v_one_fee numeric;
  r record;
  i integer;
  n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  v_minutes := betk.checkout_payment_window_minutes();
  v_mult := betk.checkout_quote_multiplier();

  -- FLAG-REG-88. Read. Do not branch.
  v_terms := betk.checkout_agreement_version('agreement_buyer_terms_version');
  v_seller_agreement := betk.checkout_agreement_version('agreement_seller_agreement_version');
  v_return_policy := betk.checkout_agreement_version('agreement_return_policy_version');
  v_privacy := betk.checkout_agreement_version('agreement_privacy_version');

  SELECT a.governorate, a.city, a.street_address, a.building_notes
    INTO v_gov, v_city, v_street, v_notes
  FROM betk.addresses AS a
  WHERE a.id = p_delivery_address_id
    AND a.buyer_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_ADDRESS_NOT_FOUND';
  END IF;

  PERFORM 1
  FROM betk.cart_items
  WHERE buyer_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_EMPTY_CART';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.buyer_id = v_uid
      AND NOT EXISTS (
        SELECT 1
        FROM betk.listings AS l
        WHERE l.id = c.listing_id
          AND l.weight_g IS NOT NULL
          AND l.deleted_at IS NULL
          AND l.status IN ('active', 'sold_out')
          AND (
            (c.is_custom AND l.price IS NOT NULL)
            OR (NOT c.is_custom AND l.price IS NOT NULL)
          )
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_LINE_UNRESOLVED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
    WHERE c.buyer_id = v_uid
      AND c.is_custom
      AND (
        q.id IS NULL
        OR q.buyer_id <> v_uid
        OR q.listing_id <> c.listing_id
        OR q.quoted_price IS NULL
        OR q.quote_expires_at IS NULL
        OR q.quote_expires_at <= now()
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_QUOTE_EXPIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    JOIN betk.inquiries AS q ON q.id = c.inquiry_id
    WHERE c.buyer_id = v_uid
      AND c.is_custom
      AND (
        q.quoted_price < l.price
        OR q.quoted_price > l.price * v_mult
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_QUOTE_OUT_OF_BAND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    WHERE c.buyer_id = v_uid
      AND l.stock_qty IS NOT NULL
      AND l.stock_qty < c.quantity
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_OUT_OF_STOCK';
  END IF;

  FOR r IN
    SELECT
      gen_random_uuid() AS seller_order_id,
      g.store_id,
      g.weight_g,
      g.subtotal
    FROM (
      SELECT
        l.store_id,
        sum(l.weight_g * c.quantity)::integer AS weight_g,
        sum(
          c.quantity * CASE
            WHEN c.is_custom THEN q.quoted_price
            ELSE l.price
          END
        ) AS subtotal
      FROM betk.cart_items AS c
      JOIN betk.listings AS l ON l.id = c.listing_id
      LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
      WHERE c.buyer_id = v_uid
      GROUP BY l.store_id
    ) AS g
  LOOP
    v_ids := v_ids || r.seller_order_id;
    v_stores := v_stores || r.store_id;
    v_weights := v_weights || r.weight_g;
    v_subs := v_subs || r.subtotal;
  END LOOP;

  n := coalesce(array_length(v_ids, 1), 0);
  IF n = 0 THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_EMPTY_CART';
  END IF;

  FOR i IN 1..n LOOP
    v_one_rate := NULL;
    v_one_fee := NULL;
    SELECT cr.id, cr.fee_egp
      INTO v_one_rate, v_one_fee
    FROM betk.stores AS s
    JOIN betk.courier_rates AS cr
      ON cr.origin_governorate = s.governorate
     AND cr.destination_governorate = v_gov
     AND cr.weight_min_g <= v_weights[i]
     AND (cr.weight_max_g IS NULL OR v_weights[i] < cr.weight_max_g)
    WHERE s.id = v_stores[i];
    IF v_one_rate IS NULL THEN
      RAISE EXCEPTION 'BETK_CHECKOUT_RATE_MISSING';
    END IF;
    v_rates := v_rates || v_one_rate;
    v_fees := v_fees || v_one_fee;
    v_child := v_child || (v_subs[i] + v_one_fee);
    v_floor := v_floor || trunc((v_subs[i] + v_one_fee) / 2, 2);
  END LOOP;

  v_master_total := 0;
  v_fee_total := 0;
  v_floor_sum := 0;
  FOR i IN 1..n LOOP
    v_master_total := v_master_total + v_child[i];
    v_fee_total := v_fee_total + v_fees[i];
    v_floor_sum := v_floor_sum + v_floor[i];
  END LOOP;
  v_master_deposit := round(v_master_total / 2, 2);
  v_leftover := round((v_master_deposit - v_floor_sum) * 100)::integer;

  SELECT array_agg(u.seller_order_id ORDER BY u.remainder DESC, u.seller_order_id ASC)
    INTO v_ranked
  FROM (
    SELECT
      v_ids[g.idx] AS seller_order_id,
      (v_child[g.idx] / 2) - v_floor[g.idx] AS remainder
    FROM generate_subscripts(v_ids, 1) AS g(idx)
  ) AS u;

  IF v_leftover >= 1 THEN
    FOR i IN 1..least(v_leftover, coalesce(array_length(v_ranked, 1), 0)) LOOP
      v_extra := v_extra || v_ranked[i];
    END LOOP;
  END IF;

  v_deposit := '{}';
  v_balance := '{}';
  FOR i IN 1..n LOOP
    v_deposit := v_deposit || (
      v_floor[i] + CASE
        WHEN v_ids[i] = ANY (v_extra) THEN 0.01
        ELSE 0
      END
    );
    v_balance := v_balance || (
      v_child[i] - v_floor[i] - CASE
        WHEN v_ids[i] = ANY (v_extra) THEN 0.01
        ELSE 0
      END
    );
  END LOOP;

  LOOP
    v_attempt := v_attempt + 1;
    v_ref := 'BETK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    BEGIN
      INSERT INTO betk.master_orders (
        buyer_id,
        betk_ref,
        delivery_address_id,
        recipient_name,
        recipient_phone,
        snapshot_governorate,
        snapshot_city,
        snapshot_street_address,
        snapshot_building_notes,
        combined_delivery_total,
        payment_deadline
      ) VALUES (
        v_uid,
        v_ref,
        p_delivery_address_id,
        NULL,
        NULL,
        v_gov,
        v_city,
        v_street,
        v_notes,
        v_fee_total,
        now() + make_interval(mins => v_minutes)
      )
      RETURNING id INTO v_master_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'BETK_REF_RETRY_EXHAUSTED';
      END IF;
    END;
  END LOOP;

  INSERT INTO betk.seller_orders (
    id,
    buyer_id,
    store_id,
    inquiry_id,
    delivery_address_id,
    delivery_method,
    delivery_fee,
    subtotal,
    total_amount,
    status,
    master_order_id,
    betk_ref,
    display_ref,
    courier_rate_id
  )
  SELECT
    u.id,
    v_uid,
    u.store_id,
    NULL,
    p_delivery_address_id,
    'delivery'::betk.delivery_preference,
    u.fee,
    u.subtotal,
    u.child_total,
    'pending'::betk.order_status,
    v_master_id,
    NULL,
    NULL,
    u.rate_id
  FROM unnest(v_ids, v_stores, v_fees, v_subs, v_child, v_rates)
    AS u(id, store_id, fee, subtotal, child_total, rate_id);

  INSERT INTO betk.order_items (
    order_id,
    listing_id,
    listing_title_ar,
    quantity,
    unit_price,
    subtotal,
    is_custom,
    inquiry_id,
    prep_days_snapshot
  )
  SELECT
    ch.id,
    l.id,
    l.title_ar,
    c.quantity,
    CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
    c.quantity * CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
    c.is_custom,
    CASE WHEN c.is_custom THEN c.inquiry_id ELSE NULL END,
    CASE WHEN c.is_custom THEN q.quoted_prep_days ELSE l.prep_days END
  FROM betk.cart_items AS c
  JOIN betk.listings AS l ON l.id = c.listing_id
  JOIN unnest(v_ids, v_stores) AS ch(id, store_id)
    ON ch.store_id = l.store_id
  LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
  WHERE c.buyer_id = v_uid;

  INSERT INTO betk.payments (order_id, payment_type, amount, method, status)
  SELECT u.id, 'deposit'::betk.payment_type, u.deposit, 'instapay'::betk.payment_method, 'pending'::betk.payment_status
  FROM unnest(v_ids, v_deposit) AS u(id, deposit)
  WHERE u.deposit > 0
  UNION ALL
  SELECT u.id, 'balance'::betk.payment_type, u.balance, 'cod'::betk.payment_method, 'pending'::betk.payment_status
  FROM unnest(v_ids, v_balance) AS u(id, balance)
  WHERE u.balance > 0;

  -- FLAG-COURIER. The matrix row has no name. The id is the value taken
  -- from the matched band.
  INSERT INTO betk.shipments (order_id, courier)
  SELECT u.id, u.rate_id::text
  FROM unnest(v_ids, v_rates) AS u(id, rate_id);

  INSERT INTO betk.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_type, notes
  )
  SELECT u.id, NULL::betk.order_status, 'pending'::betk.order_status, v_uid, 'buyer'::betk.cancelled_by_type, 'order created'
  FROM unnest(v_ids) AS u(id);

  DELETE FROM betk.cart_items WHERE buyer_id = v_uid;

  RETURN v_master_id;
END;
$function$;

-- CF-4. Last statements (plan §6 M8).
DROP TRIGGER IF EXISTS trg_set_inquiry_converted_order ON betk.seller_orders;
DROP FUNCTION IF EXISTS betk.set_inquiry_converted_order();

-- 20261003214258_v2_09_publish_and_submit (P09M1; backfilled here for source parity).

-- P09M1. Phase 09 publish gate and onboarding submit. Not applied to staging.
-- F-P1 narrows when enforce_listing_publish runs. F-P2 requires the four
-- food document types to be approved. T04 applies this file byte-for-byte.
-- One migration transaction. No admin_settings UPDATE. checkout_from_cart
-- is not in this file.
--
-- Sources (SELECT 2026-10-03 unless named):
-- ERD §6.3 publish gate. Pack PHASE_09_V2_SURFACES.md §5 (b) rows.
-- Plan §8.2.5 fail-closed. Live submit_seller_application (15 args, INVOKER,
-- search_path betk, public) and resubmit_seller_application (2 args, INVOKER).
-- Live enforce_store_category_cap is the DEFINER + REVOKE pattern copied here.
-- chk_active_listing_shipping stays the AC-CAT-2 check. It is not repeated.
-- The three live active listings are not scanned and not backfilled.
--
-- CREATE OR REPLACE of the two RPCs keeps their grants (authenticated
-- EXECUTE; public and anon false). This file does not GRANT.

-- Listings publish gate (F-P1). The checks run only when the row is being
-- published: INSERT with status active; UPDATE to active from draft, paused,
-- or removed; or UPDATE that leaves status active and changes type,
-- price_type, price, prep_days, category_id, subcategory_id, or store_id.
-- Every other update returns NEW unchecked, including a stock-only update,
-- sold_out to or from active, and an edit to a non-publish column. Empty
-- prep cap or either price band key fails closed. food_requirements is read
-- and not parsed. F-P2: a food publish needs four distinct food document
-- types with review_status approved. The approved-category check stays.
CREATE OR REPLACE FUNCTION betk.enforce_listing_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_cap_raw text;
  v_cap integer;
  v_min_raw text;
  v_max_raw text;
  v_min numeric;
  v_max numeric;
  v_is_food boolean;
  v_food_raw text;
  v_docs integer;
  v_publish boolean;
BEGIN
  -- F-P1. Check only a publish. Anything else returns NEW unchecked.
  v_publish := FALSE;
  IF TG_OP = 'INSERT' AND NEW.status = 'active'::betk.listing_status THEN
    v_publish := TRUE;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'active'::betk.listing_status THEN
    IF OLD.status IN (
      'draft'::betk.listing_status,
      'paused'::betk.listing_status,
      'removed'::betk.listing_status
    ) THEN
      v_publish := TRUE;
    ELSIF NEW.type IS DISTINCT FROM OLD.type
       OR NEW.price_type IS DISTINCT FROM OLD.price_type
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.prep_days IS DISTINCT FROM OLD.prep_days
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id
       OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
      v_publish := TRUE;
    END IF;
  END IF;
  IF NOT v_publish THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'product'::betk.listing_type THEN
    RAISE EXCEPTION 'BETK_LISTING_TYPE';
  END IF;

  IF NEW.price_type IS DISTINCT FROM 'fixed'::betk.price_type OR NEW.price IS NULL THEN
    RAISE EXCEPTION 'BETK_PRICE_TYPE';
  END IF;

  SELECT value INTO v_cap_raw
  FROM betk.admin_settings
  WHERE key = 'prep_cap_days';
  IF v_cap_raw IS NULL OR btrim(v_cap_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_PREP_CAP_UNCONFIGURED';
  END IF;
  v_cap := btrim(v_cap_raw)::integer;
  IF NEW.prep_days IS NULL OR NEW.prep_days < 0 OR NEW.prep_days > v_cap THEN
    RAISE EXCEPTION 'BETK_PREP_CAP';
  END IF;

  SELECT value INTO v_min_raw
  FROM betk.admin_settings
  WHERE key = 'price_band_min_egp';
  SELECT value INTO v_max_raw
  FROM betk.admin_settings
  WHERE key = 'price_band_max_egp';
  IF v_min_raw IS NULL OR btrim(v_min_raw) !~ '^[0-9]+(\.[0-9]+)?$'
     OR v_max_raw IS NULL OR btrim(v_max_raw) !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND_UNCONFIGURED';
  END IF;
  v_min := btrim(v_min_raw)::numeric;
  v_max := btrim(v_max_raw)::numeric;
  IF v_min > v_max THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND_UNCONFIGURED';
  END IF;
  IF NEW.price < v_min OR NEW.price > v_max THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM betk.store_categories
    WHERE store_id = NEW.store_id
      AND category_id = NEW.category_id
      AND approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'BETK_CATEGORY_NOT_APPROVED';
  END IF;

  SELECT EXISTS (
    WITH RECURSIVE food AS (
      SELECT id
      FROM betk.categories
      WHERE slug = 'food-beverages'
      UNION ALL
      SELECT c.id
      FROM betk.categories AS c
      JOIN food AS f ON c.parent_id = f.id
    )
    SELECT 1
    FROM food
    WHERE food.id IN (NEW.category_id, NEW.subcategory_id)
  ) INTO v_is_food;

  IF v_is_food THEN
    SELECT value INTO v_food_raw
    FROM betk.admin_settings
    WHERE key = 'food_requirements';
    IF v_food_raw IS NULL OR btrim(v_food_raw) = '' THEN
      RAISE EXCEPTION 'BETK_FOOD_REQUIREMENTS_UNCONFIGURED';
    END IF;

    -- F-P2. Distinct types, and only rows the reviewer approved.
    SELECT count(DISTINCT d.document_type)::integer INTO v_docs
    FROM betk.seller_documents AS d
    JOIN betk.stores AS s
      ON s.id = NEW.store_id
     AND s.seller_id = d.seller_id
    WHERE d.document_type = ANY (ARRAY[
      'food_packaging',
      'food_label',
      'food_expiry',
      'food_social_url'
    ]::betk.doc_type[])
      AND d.review_status = 'approved';
    IF v_docs < 4 THEN
      RAISE EXCEPTION 'BETK_FOOD_APPROVAL_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_listing_publish() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_listing_publish ON betk.listings;
CREATE TRIGGER trg_enforce_listing_publish
  BEFORE INSERT OR UPDATE ON betk.listings
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_listing_publish();

-- Non-admin INSERT cannot stamp store_categories.approved_at.
-- Live store_categories_insert WITH CHECK does not mention the column
-- (SELECT 2026-10-03). UPDATE stays the live admin-only policy; this
-- trigger is BEFORE INSERT only. is_admin() is false when auth.uid() is
-- null, so a service-role INSERT is stored with approved_at null.
CREATE OR REPLACE FUNCTION betk.force_store_category_approved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.approved_at IS NOT NULL AND NOT betk.is_admin() THEN
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.force_store_category_approved_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_force_store_category_approved_at ON betk.store_categories;
CREATE TRIGGER trg_force_store_category_approved_at
  BEFORE INSERT ON betk.store_categories
  FOR EACH ROW
  EXECUTE FUNCTION betk.force_store_category_approved_at();

-- AC-AGR-3 and REG-65. Argument list is the live 15-arg list. INVOKER.
-- p_category_primary and p_category_secondary are stored on the
-- non-authoritative store columns. They are not matched to categories.id.
-- No store_categories row is inserted here. p_delivery_options is not written.
CREATE OR REPLACE FUNCTION betk.submit_seller_application(p_name_ar text, p_name_en text, p_bio_ar text, p_slug text, p_category_primary text, p_category_secondary text, p_governorate text, p_city text, p_payment_methods jsonb, p_delivery_options jsonb, p_return_policy text, p_min_order_egp numeric, p_doc_front_path text, p_doc_back_path text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'betk', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_constraint text;
  v_version text;
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  v_version := betk.checkout_agreement_version('agreement_seller_agreement_version');
  if v_version is null or btrim(v_version) = '' then
    raise exception 'BETK_AGREEMENT_VERSION_UNCONFIGURED';
  end if;
  if not exists (
    select 1
    from betk.agreement_acceptances
    where user_id = v_uid
      and document = 'seller_agreement'
      and version_label = v_version
      and status = 'accepted'
  ) then
    raise exception 'BETK_SELLER_AGREEMENT_REQUIRED';
  end if;

  insert into betk.seller_profiles (id, status, level, submitted_at)
  values (v_uid, 'pending', 'bronze', now());

  insert into betk.stores (
    seller_id, name_ar, name_en, slug, bio_ar,
    category_primary, category_secondary, governorate, city,
    payment_methods, delivery_options, return_policy, min_order_egp, status
  )
  values (
    v_uid, p_name_ar, p_name_en, p_slug, p_bio_ar,
    p_category_primary, p_category_secondary, p_governorate, p_city,
    coalesce(p_payment_methods, '{}'::jsonb),
    '{}'::jsonb,
    p_return_policy, p_min_order_egp, 'pending'
  );

  insert into betk.seller_documents (seller_id, document_type, storage_path, review_status)
  values
    (v_uid, 'national_id_front', p_doc_front_path, 'pending'),
    (v_uid, 'national_id_back',  p_doc_back_path,  'pending');

exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_stores_slug' then
      raise exception 'BETK_SLUG_TAKEN';
    elsif v_constraint in ('seller_profiles_pkey', 'uq_stores_seller', 'uq_seller_doc_type') then
      raise exception 'BETK_APPLICATION_EXISTS';
    else
      raise;
    end if;
end;
$function$;

-- Same acceptance gate. Argument list is the live 2-arg list. INVOKER.
-- This body does not write stores.delivery_options.
CREATE OR REPLACE FUNCTION betk.resubmit_seller_application(p_doc_front_path text, p_doc_back_path text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'betk', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_version text;
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  v_version := betk.checkout_agreement_version('agreement_seller_agreement_version');
  if v_version is null or btrim(v_version) = '' then
    raise exception 'BETK_AGREEMENT_VERSION_UNCONFIGURED';
  end if;
  if not exists (
    select 1
    from betk.agreement_acceptances
    where user_id = v_uid
      and document = 'seller_agreement'
      and version_label = v_version
      and status = 'accepted'
  ) then
    raise exception 'BETK_SELLER_AGREEMENT_REQUIRED';
  end if;

  update betk.seller_profiles
  set rejected_reason = null,
      submitted_at = now()
  where id = v_uid
    and status = 'pending'
    and rejected_reason is not null;

  if not found then
    raise exception 'BETK_NOT_REJECTED';
  end if;

  update betk.seller_documents
  set storage_path = p_doc_front_path,
      review_status = 'pending',
      reviewed_at = null,
      uploaded_at = now()
  where seller_id = v_uid and document_type = 'national_id_front';

  update betk.seller_documents
  set storage_path = p_doc_back_path,
      review_status = 'pending',
      reviewed_at = null,
      uploaded_at = now()
  where seller_id = v_uid and document_type = 'national_id_back';
end;
$function$;

-- P09M2, applied 20261004172620 / v2_09_approval_state_actor.
-- Approval-state columns are admin-only for end users (S1).
-- EXECUTE revoked from PUBLIC, anon, and authenticated.
CREATE OR REPLACE FUNCTION betk.enforce_approval_state_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR betk.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'seller_documents' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.review_status := 'pending'::betk.doc_review_status;
      NEW.reviewed_at := NULL;
      RETURN NEW;
    END IF;
    IF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      IF NEW.review_status = 'pending'::betk.doc_review_status
         AND NEW.reviewed_at IS NULL THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'seller_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IS DISTINCT FROM 'pending'::betk.seller_status
         OR NEW.level IS DISTINCT FROM 'bronze'::betk.seller_level
         OR NEW.level_score IS DISTINCT FROM 0
         OR NEW.is_verified
         OR NEW.suspension_ends_at IS NOT NULL
         OR NEW.approved_at IS NOT NULL
         OR NEW.rejected_reason IS NOT NULL
         OR NEW.strike_count IS DISTINCT FROM 0
         OR NEW.total_orders_completed IS DISTINCT FROM 0
         OR NEW.total_reviews_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.suspension_ends_at IS DISTINCT FROM OLD.suspension_ends_at
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.level_score IS DISTINCT FROM OLD.level_score
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.total_orders_completed IS DISTINCT FROM OLD.total_orders_completed
       OR NEW.total_reviews_count IS DISTINCT FROM OLD.total_reviews_count
       OR NEW.strike_count IS DISTINCT FROM OLD.strike_count
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.rejected_reason IS DISTINCT FROM OLD.rejected_reason
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      IF NEW.rejected_reason IS NULL
         AND OLD.rejected_reason IS NOT NULL
         AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         AND NEW.status IS NOT DISTINCT FROM OLD.status
         AND NEW.suspension_ends_at IS NOT DISTINCT FROM OLD.suspension_ends_at
         AND NEW.level IS NOT DISTINCT FROM OLD.level
         AND NEW.level_score IS NOT DISTINCT FROM OLD.level_score
         AND NEW.is_verified IS NOT DISTINCT FROM OLD.is_verified
         AND NEW.total_orders_completed IS NOT DISTINCT FROM OLD.total_orders_completed
         AND NEW.total_reviews_count IS NOT DISTINCT FROM OLD.total_reviews_count
         AND NEW.strike_count IS NOT DISTINCT FROM OLD.strike_count
         AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'stores' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IS DISTINCT FROM 'pending'::betk.store_status THEN
        RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_approval_state_actor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_seller_document_approval_state ON betk.seller_documents;
CREATE TRIGGER trg_enforce_seller_document_approval_state
  BEFORE INSERT OR UPDATE ON betk.seller_documents
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();

DROP TRIGGER IF EXISTS trg_enforce_seller_profile_approval_state ON betk.seller_profiles;
CREATE TRIGGER trg_enforce_seller_profile_approval_state
  BEFORE INSERT OR UPDATE ON betk.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();

DROP TRIGGER IF EXISTS trg_enforce_store_approval_state ON betk.stores;
CREATE TRIGGER trg_enforce_store_approval_state
  BEFORE INSERT OR UPDATE ON betk.stores
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();

-- 20261006100204_v2_10_cart_quote (P10M1; backfilled here for source parity).

-- P10M1. Cart and quote integrity (part A) and REG-107 (part B).
-- Not applied. T01 authors this file. A later apply is byte-for-byte.
-- One migration transaction. No inner BEGIN or COMMIT. apply_migration
-- wraps the file. Two labelled parts. No new table. No policy. No phone
-- predicate. No admin_settings write. checkout_from_cart is not replaced.
--
-- R-LOCK (planning chat, 2026-10-06). Supersedes "do not regrant any
-- cart_items column" and the row-lock FINDING. checkout_from_cart is
-- SECURITY INVOKER and takes FOR UPDATE on the buyer's cart_items
-- (supabase/migrations/20261003082041_v2_08_functions.sql lines 784-787).
-- PostgreSQL requires UPDATE privilege on at least one column for
-- SELECT ... FOR UPDATE. Part A revokes the table UPDATE and re-grants
-- UPDATE (updated_at) only, to authenticated. cart_items_update still
-- limits the row to the buyer. No price, quantity, listing, or inquiry
-- column is granted.
--
-- R-FREEZE (planning chat, 2026-10-06). checkout_from_cart prices a
-- custom line at the inquiry's live quoted_price
-- (supabase/migrations/20261003082041_v2_08_functions.sql line 869, and
-- order_items.unit_price at line 1044). send_inquiry_quote refuses with
-- BETK_QUOTE_LINE_HELD when any cart_items row references the inquiry,
-- before the quote UPDATE. The function is SECURITY DEFINER, so the
-- check sees every buyer's rows. An expired line is cleared by removing
-- the line, then a fresh quote, then accept.
--
-- R-AVAIL (planning chat, 2026-10-06). add_fixed_cart_item,
-- accept_inquiry_quote, and send_inquiry_quote each refuse when the
-- listing is not status 'active', when deleted_at is set, or when its
-- store is not status 'active'. The store test is the public arm of
-- stores_public (R-S07): status = 'active'. Owner and admin do not
-- bypass it. Codes: add listing BETK_CART_LISTING_UNAVAILABLE, add store
-- BETK_CART_STORE_INACTIVE, accept and send listing
-- BETK_QUOTE_LISTING_UNAVAILABLE, accept and send store
-- BETK_QUOTE_STORE_INACTIVE.
--
-- R-DECLINED (planning chat, 2026-10-06). accept_inquiry_quote and
-- send_inquiry_quote refuse with BETK_QUOTE_DECLINED when the inquiry
-- status is 'declined'. Live inquiry_status (pg_enum, 2026-10-06):
-- open, replied, confirmed, declined, expired. The other four are not
-- refused by this check.
--
-- R-TRIGGER (planning chat, 2026-10-06).
-- trg_recompute_avg_response_hours fires only when
-- NEW.sender_type = 'seller'. The function body is unchanged.
--
-- Sources for the bodies: PHASE_10_CART_QUOTE.md §5 and §6 (R-ENFORCE,
-- R-107, R-LOCK, R-FREEZE, R-AVAIL, R-DECLINED, R-TRIGGER), BETK_PRD.md
-- R-C01, R-C04, R-C06, R-Q01-R-Q05,
-- BETK_ERD.md §6.1 cart_items, computeAvgResponseHours in
-- src/features/messaging/messagingRules.ts lines 82-98.
-- Live facts used below were read 2026-10-06 (MCP execute_sql and
-- list_migrations). Ledger 41, last 20261004172620. This file does not
-- change that.

-- ── Part A. Cart and quote ────────────────────────────────────────────────

-- Fixed-price add. The only authenticated insert. Guest refusal is the
-- body (auth.uid() null). anon has no EXECUTE. unit_price is copied from
-- listings.price and is not rewritten on a later price change. A second
-- fixed line for the same listing is refused; quantity changes go through
-- set_cart_item_quantity. Tracked stock (stock_qty not null) bounds the
-- quantity. Made-to-order and unpriced listings are not this function.
-- R-AVAIL: not active, deleted, or a store that is not active.
CREATE OR REPLACE FUNCTION betk.add_fixed_cart_item(
  p_listing_id uuid,
  p_quantity smallint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_price numeric(10,2);
  v_stock integer;
  v_made boolean;
  v_status betk.listing_status;
  v_price_type betk.price_type;
  v_deleted timestamptz;
  v_store_status betk.store_status;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'BETK_CART_QUANTITY';
  END IF;

  SELECT l.price, l.stock_qty, l.is_made_to_order, l.status, l.price_type, l.deleted_at, s.status
    INTO v_price, v_stock, v_made, v_status, v_price_type, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = p_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_CART_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_CART_STORE_INACTIVE';
  END IF;
  IF v_made
     OR v_price IS NULL
     OR v_price <= 0
     OR v_price_type IS DISTINCT FROM 'fixed'::betk.price_type THEN
    RAISE EXCEPTION 'BETK_CART_NOT_FIXED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.buyer_id = v_uid
      AND c.listing_id = p_listing_id
      AND c.inquiry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END IF;

  IF v_stock IS NOT NULL AND p_quantity > v_stock THEN
    RAISE EXCEPTION 'BETK_CART_OUT_OF_STOCK';
  END IF;

  BEGIN
    INSERT INTO betk.cart_items (
      buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
    ) VALUES (
      v_uid, p_listing_id, p_quantity, v_price, false, NULL
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.add_fixed_cart_item(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.add_fixed_cart_item(uuid, smallint) TO authenticated;

-- Quantity change. Own row only. Does not change unit_price. Does not
-- delete: quantity below 1 is refused, and remove stays the DELETE grant.
-- A custom line, a made-to-order listing, or a null stock_qty is not
-- stock-bounded (R-C04, R-L15). A tracked fixed line must be <= stock_qty.
CREATE OR REPLACE FUNCTION betk.set_cart_item_quantity(
  p_cart_item_id uuid,
  p_quantity smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_custom boolean;
  v_listing_id uuid;
  v_stock integer;
  v_made boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'BETK_CART_QUANTITY';
  END IF;

  SELECT c.is_custom, c.listing_id
    INTO v_custom, v_listing_id
  FROM betk.cart_items AS c
  WHERE c.id = p_cart_item_id
    AND c.buyer_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CART_LINE_NOT_FOUND';
  END IF;

  SELECT l.stock_qty, l.is_made_to_order
    INTO v_stock, v_made
  FROM betk.listings AS l
  WHERE l.id = v_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CART_LISTING_UNAVAILABLE';
  END IF;

  IF NOT v_custom
     AND NOT v_made
     AND v_stock IS NOT NULL
     AND p_quantity > v_stock THEN
    RAISE EXCEPTION 'BETK_CART_OUT_OF_STOCK';
  END IF;

  UPDATE betk.cart_items
  SET quantity = p_quantity,
      updated_at = now()
  WHERE id = p_cart_item_id
    AND buyer_id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.set_cart_item_quantity(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.set_cart_item_quantity(uuid, smallint) TO authenticated;

-- Quote accept. Own inquiry, quote present, quote_expires_at after now().
-- One custom cart line at quoted_price. Does not rewrite an existing line.
-- Does not re-check the band. No phone check. R-DECLINED refuses status
-- 'declined'. R-AVAIL refuses a listing that is not active, is deleted,
-- or whose store is not active.
CREATE OR REPLACE FUNCTION betk.accept_inquiry_quote(p_inquiry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_listing_id uuid;
  v_qty smallint;
  v_quoted_price numeric(10,2);
  v_prep smallint;
  v_expires timestamptz;
  v_quoted_at timestamptz;
  v_inquiry_status betk.inquiry_status;
  v_listing_status betk.listing_status;
  v_deleted timestamptz;
  v_store_status betk.store_status;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  SELECT i.listing_id, i.quantity, i.quoted_price, i.quoted_prep_days, i.quote_expires_at, i.quoted_at, i.status
    INTO v_listing_id, v_qty, v_quoted_price, v_prep, v_expires, v_quoted_at, v_inquiry_status
  FROM betk.inquiries AS i
  WHERE i.id = p_inquiry_id
    AND i.buyer_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_FOUND';
  END IF;
  IF v_inquiry_status = 'declined'::betk.inquiry_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_DECLINED';
  END IF;
  IF v_quoted_price IS NULL
     OR v_prep IS NULL
     OR v_expires IS NULL
     OR v_quoted_at IS NULL THEN
    RAISE EXCEPTION 'BETK_QUOTE_ABSENT';
  END IF;
  IF v_expires <= now() THEN
    RAISE EXCEPTION 'BETK_QUOTE_EXPIRED';
  END IF;
  IF v_qty IS NULL OR v_qty < 1 THEN
    v_qty := 1;
  END IF;

  SELECT l.status, l.deleted_at, s.status
    INTO v_listing_status, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = v_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_listing_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_STORE_INACTIVE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.buyer_id = v_uid
      AND c.inquiry_id = p_inquiry_id
  ) THEN
    RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END IF;

  BEGIN
    INSERT INTO betk.cart_items (
      buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
    ) VALUES (
      v_uid, v_listing_id, v_qty, v_quoted_price, true, p_inquiry_id
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.accept_inquiry_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.accept_inquiry_quote(uuid) TO authenticated;

-- Quote send. Store owner only (my_store_id), not admin. Eligible listing:
-- is_made_to_order or price IS NULL. Band is checkout_quote_multiplier
-- when the listing has a price; the closed interval is stored. An unpriced
-- listing has no numeric floor or ceiling; the multiplier is still called
-- so an unconfigured key writes nothing. Prep null or negative is refused;
-- zero is legal (column check >= 0). quote_expires_at comes from
-- quote_validity_hours. Empty or non-positive-integer fails closed.
-- Does not write status. Does not update cart_items. R-FREEZE reads
-- cart_items and refuses with BETK_QUOTE_LINE_HELD before the UPDATE.
-- R-DECLINED refuses status 'declined'. R-AVAIL refuses a listing that
-- is not active, is deleted, or whose store is not active.
CREATE OR REPLACE FUNCTION betk.send_inquiry_quote(
  p_inquiry_id uuid,
  p_quoted_price numeric,
  p_prep_days smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_store uuid;
  v_listing_id uuid;
  v_list_price numeric(10,2);
  v_made boolean;
  v_quote numeric(10,2);
  v_mult numeric;
  v_raw text;
  v_hours integer;
  v_expires timestamptz;
  v_inquiry_status betk.inquiry_status;
  v_listing_status betk.listing_status;
  v_deleted timestamptz;
  v_store_status betk.store_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  v_store := betk.my_store_id();
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_OWNER';
  END IF;

  SELECT i.listing_id, i.status
    INTO v_listing_id, v_inquiry_status
  FROM betk.inquiries AS i
  WHERE i.id = p_inquiry_id
    AND i.store_id = v_store
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_OWNER';
  END IF;
  -- DEFINER: this sees every buyer's cart_items row. No buyer filter.
  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.inquiry_id = p_inquiry_id
  ) THEN
    RAISE EXCEPTION 'BETK_QUOTE_LINE_HELD';
  END IF;
  IF v_inquiry_status = 'declined'::betk.inquiry_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_DECLINED';
  END IF;

  SELECT l.price, l.is_made_to_order, l.status, l.deleted_at, s.status
    INTO v_list_price, v_made, v_listing_status, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = v_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_listing_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_STORE_INACTIVE';
  END IF;
  IF NOT (v_made OR v_list_price IS NULL) THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_INELIGIBLE';
  END IF;

  IF p_prep_days IS NULL OR p_prep_days < 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PREP_REQUIRED';
  END IF;
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END IF;
  BEGIN
    v_quote := p_quoted_price::numeric(10,2);
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END;
  IF v_quote IS NULL OR v_quote <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END IF;

  v_mult := betk.checkout_quote_multiplier();
  IF v_list_price IS NOT NULL
     AND (v_quote < v_list_price OR v_quote > v_list_price * v_mult) THEN
    RAISE EXCEPTION 'BETK_QUOTE_OUT_OF_BAND';
  END IF;

  SELECT s.value
    INTO v_raw
  FROM betk.admin_settings AS s
  WHERE s.key = 'quote_validity_hours';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_QUOTE_VALIDITY_UNCONFIGURED';
  END IF;
  BEGIN
    v_hours := btrim(v_raw)::integer;
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION 'BETK_QUOTE_VALIDITY_UNCONFIGURED';
  END;
  v_expires := now() + make_interval(hours => v_hours);

  UPDATE betk.inquiries
  SET quoted_price = v_quote,
      quoted_prep_days = p_prep_days,
      quote_expires_at = v_expires,
      quoted_at = now()
  WHERE id = p_inquiry_id
    AND store_id = v_store;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.send_inquiry_quote(uuid, numeric, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.send_inquiry_quote(uuid, numeric, smallint) TO authenticated;

-- Buyer insert and table update go away. SELECT and DELETE stay.
-- anon is not in this revoke (live ACL is already SELECT only).
-- R-LOCK: UPDATE (updated_at) only, so the invoker row lock still has
-- the privilege PostgreSQL checks. Quantity, unit_price, listing_id,
-- inquiry_id, is_custom, buyer_id, id, and created_at are not granted.
REVOKE INSERT, UPDATE ON TABLE betk.cart_items FROM authenticated;
GRANT UPDATE (updated_at) ON TABLE betk.cart_items TO authenticated;

-- Seller quote columns are not regranted. status stays, because
-- sendInquiryMessage, confirmInquiry, and declineInquiry still update it
-- until T04. service_role is not in this revoke.
REVOKE UPDATE ON TABLE betk.inquiries FROM authenticated;
GRANT UPDATE (status) ON TABLE betk.inquiries TO authenticated;

-- ── Part B. REG-107 ───────────────────────────────────────────────────────

-- AFTER INSERT on inquiry_messages. Mean, across the store's inquiries
-- that have a first seller reply, of (first seller sent_at minus
-- inquiries.created_at) in hours. A negative gap is skipped. Null
-- timestamps are skipped. The mean is rounded to two decimals and capped
-- at 999.99. Null when no gap remains. Same order as
-- computeAvgResponseHours: round, then cap. sender_type 'seller' only.
-- Writes seller_profiles.avg_response_hours for stores.seller_id.
-- enforce_approval_state_actor does not list that column, so this update
-- is not BETK_APPROVAL_STATE_ACTOR. No argument, so a caller cannot pass
-- an arbitrary average. EXECUTE is revoked.
CREATE OR REPLACE FUNCTION betk.recompute_seller_avg_response_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_seller uuid;
  v_avg numeric(5,2);
BEGIN
  SELECT i.store_id, s.seller_id
    INTO v_store_id, v_seller
  FROM betk.inquiries AS i
  JOIN betk.stores AS s ON s.id = i.store_id
  WHERE i.id = NEW.inquiry_id;

  IF v_seller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT LEAST(round(avg(gaps.gap_hours)::numeric, 2), 999.99)::numeric(5,2)
    INTO v_avg
  FROM (
    SELECT (EXTRACT(EPOCH FROM (fr.first_sent - i.created_at)) / 3600.0) AS gap_hours
    FROM betk.inquiries AS i
    JOIN LATERAL (
      SELECT min(m.sent_at) AS first_sent
      FROM betk.inquiry_messages AS m
      WHERE m.inquiry_id = i.id
        AND m.sender_type = 'seller'::betk.sender_type
    ) AS fr ON fr.first_sent IS NOT NULL
    WHERE i.store_id = v_store_id
      AND i.created_at IS NOT NULL
  ) AS gaps
  WHERE gaps.gap_hours IS NOT NULL
    AND gaps.gap_hours >= 0;

  UPDATE betk.seller_profiles
  SET avg_response_hours = v_avg
  WHERE id = v_seller;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.recompute_seller_avg_response_hours() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recompute_avg_response_hours ON betk.inquiry_messages;
-- R-TRIGGER: seller messages only. The function body above is unchanged.
CREATE TRIGGER trg_recompute_avg_response_hours
  AFTER INSERT ON betk.inquiry_messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'seller')
  EXECUTE FUNCTION betk.recompute_seller_avg_response_hours();

-- Table UPDATE goes away. The four columns the approval writers still
-- set are regranted. avg_response_hours is not one of them. INSERT and
-- SELECT stay. service_role is not in this revoke. The approval trigger
-- still refuses a seller transition that is not the resubmit shape.
REVOKE UPDATE ON TABLE betk.seller_profiles FROM authenticated;
GRANT UPDATE (rejected_reason, submitted_at, status, approved_at)
  ON TABLE betk.seller_profiles TO authenticated;
