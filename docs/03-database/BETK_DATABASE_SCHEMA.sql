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
-- REG-49 (Phase 07 / T02b): payments INSERT/UPDATE + orders UPDATE write layer + the checkout RPC
--   (create_order_from_inquiry, backfilled with the other RPCs at the tail of §11). ERD §3 rows
--   54 (orders) / 57 (payments) / 71 (moderation_logs) + the OD-8 † amendment. TRAP-2 three-layer
--   write model: column GRANT (REG-42 pattern) narrows authenticated's table-wide UPDATE to the
--   writable columns; a permissive row POLICY scopes the parties; an OLD-aware BEFORE UPDATE DEFINER
--   trigger enforces actor↔column + transition legality. anon RETAINS its table-wide UPDATE grant
--   (harmless — both new policies are TO authenticated, RLS is on, auth.uid() is null for anon;
--   ADR-015): any FUTURE "TO public" UPDATE policy on these tables MUST be TO authenticated or must
--   first re-scope anon's grant, else it inherits it silently. Trigger fns are search_path-pinned
--   + EXECUTE-revoked from PUBLIC/anon/authenticated. Migration
--   20260723140552_order_payment_write_layer_reg49. ADR-018 (checkout rpc) + ADR-019 (three-layer
--   write model + commission trigger + admin_settings read broadening).
-- TRAP 1 (ii) / REG-69 (STANDING): buyer reads the 4 payment-config keys at checkout. The key IN (...)
--   allow-list is LITERAL — never a prefix/pattern (e.g. key LIKE 'betk_%') or a NOT-IN, and NO secret
--   may EVER be stored under these 4 keys. commission_rate_pct + return_hold_hours are DELIBERATELY
--   excluded (commission is read server-side by the DEFINER trigger; return_hold_hours is Phase 13).
CREATE POLICY settings_payment_config_read ON betk.admin_settings FOR SELECT
  TO authenticated
  USING (key IN ('betk_instapay_handle','betk_vodafone_cash','betk_orange_cash','delivery_fee_flat_egp'));
-- payments INSERT — ERD §3 row 57 INSERT = 'system (checkout)': buyer-of-parent only (mirrors
--   order_items_insert). No admin/seller INSERT branch.
CREATE POLICY payments_insert ON betk.payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid())
  );
-- payments UPDATE — three-layer. Layer 1 column GRANT: amount/payment_type/order_id/method/id/
--   created_at become UNTOUCHABLE (a forbidden write => 42501, not a silent 0-row no-op).
REVOKE UPDATE ON betk.payments FROM authenticated;
GRANT  UPDATE (status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference)
       ON betk.payments TO authenticated;
-- Layer 2 row policy: parties via the parent order. THE SELLER GETS NO payments UPDATE.
CREATE POLICY payments_update ON betk.payments FOR UPDATE TO authenticated
  USING      ( betk.is_admin()
            OR EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid()) )
  WITH CHECK ( betk.is_admin()
            OR EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid()) );
-- Layer 3 OLD-aware trigger: admin-only columns; F2 transition legality (ONLY pending->confirmed;
--   refunded/failed = Phase 10/14); buyer proof-attach on own pending deposit row only.
CREATE OR REPLACE FUNCTION betk.enforce_payment_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
BEGIN
  IF ( NEW.status IS DISTINCT FROM OLD.status
    OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    OR NEW.notes IS DISTINCT FROM OLD.notes ) THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_PAYMENT_ADMIN_ONLY';
    END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'confirmed') THEN
      RAISE EXCEPTION 'BETK_ILLEGAL_PAYMENT_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  IF ( NEW.proof_path IS DISTINCT FROM OLD.proof_path
    OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference ) THEN
    IF NOT ( OLD.payment_type = 'deposit' AND OLD.status = 'pending'
         AND EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = OLD.order_id AND o.buyer_id = auth.uid()) ) THEN
      RAISE EXCEPTION 'BETK_PAYMENT_PROOF_FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.enforce_payment_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_payment_update BEFORE UPDATE ON betk.payments
  FOR EACH ROW EXECUTE FUNCTION betk.enforce_payment_update();
-- orders UPDATE — three-layer. Layer 1 column GRANT (F1): only status + cancellation_reason are
--   client-writable. cancelled_by is trigger-stamped (like confirmed_at); money/betk_ref/buyer_id/
--   store_id/delivered_at/tracking stay UNTOUCHABLE.
REVOKE UPDATE ON betk.orders FROM authenticated;
GRANT  UPDATE (status, cancellation_reason) ON betk.orders TO authenticated;
-- Layer 2 row policy: buyer own OR store OR admin (ERD row 54 verbatim; SUB-DECISION A KEEPS admin in
--   the policy — the trigger, not the policy, scopes the Phase-07 transitions).
CREATE POLICY orders_update ON betk.orders FOR UPDATE TO authenticated
  USING      ( buyer_id = auth.uid() OR store_id = betk.my_store_id() OR betk.is_admin() )
  WITH CHECK ( buyer_id = auth.uid() OR store_id = betk.my_store_id() OR betk.is_admin() );
-- Layer 3 OLD-aware trigger: F1 cancel-metadata guard (outside the status branch); accept (store-only
--   + AC-SEL-14 deposit-confirmed gate, stamps confirmed_at); preparing (store-only); cancel (R-O03
--   pending-only, buyer-only, stamps cancelled_by='buyer'). SUB-DECISION A: admin is DROPPED from the
--   three actor checks (Phase 14 amends this trigger for admin-forced cancellation).
CREATE OR REPLACE FUNCTION betk.enforce_order_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
BEGIN
  IF ( NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
    OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason ) THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'BETK_CANCEL_METADATA_FORBIDDEN';
    END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      IF NOT (OLD.store_id = betk.my_store_id()) THEN
        RAISE EXCEPTION 'BETK_ORDER_ACCEPT_STORE_ONLY';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM betk.payments p
                     WHERE p.order_id = OLD.id AND p.payment_type = 'deposit' AND p.status = 'confirmed') THEN
        RAISE EXCEPTION 'BETK_DEPOSIT_UNCONFIRMED';
      END IF;
      NEW.confirmed_at := now();
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'preparing' THEN
      IF NOT (OLD.store_id = betk.my_store_id()) THEN
        RAISE EXCEPTION 'BETK_ORDER_PREPARING_STORE_ONLY';
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      IF OLD.status <> 'pending' THEN
        RAISE EXCEPTION 'BETK_NOT_CANCELLABLE';
      END IF;
      IF NOT (OLD.buyer_id = auth.uid()) THEN
        RAISE EXCEPTION 'BETK_ORDER_CANCEL_BUYER_ONLY';
      END IF;
      NEW.cancelled_by := 'buyer'::betk.cancelled_by_type;
    ELSE
      RAISE EXCEPTION 'BETK_ILLEGAL_ORDER_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.enforce_order_transition() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_order_transition BEFORE UPDATE ON betk.orders
  FOR EACH ROW EXECUTE FUNCTION betk.enforce_order_transition();
-- TRAP 1 (i): commission snapshot via DEFINER BEFORE INSERT (buyer never reads the rate). Commission
--   on SUBTOTAL (never total_amount). F5: a MISSING commission_rate_pct row RAISEs (config fault);
--   an explicit '0' (or empty) passes through as 0.
CREATE OR REPLACE FUNCTION betk.set_order_commission_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
DECLARE v_raw text; v_rate numeric;
BEGIN
  SELECT value INTO v_raw FROM betk.admin_settings WHERE key = 'commission_rate_pct';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_COMMISSION_CONFIG_MISSING';
  END IF;
  v_rate := COALESCE(NULLIF(v_raw, '')::numeric, 0);
  NEW.commission_rate   := v_rate;
  NEW.commission_amount := round(v_rate / 100 * NEW.subtotal, 2);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.set_order_commission_snapshot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_set_order_commission_snapshot BEFORE INSERT ON betk.orders
  FOR EACH ROW EXECUTE FUNCTION betk.set_order_commission_snapshot();
-- moderation_logs INSERT — ERD §3 row 71 (#14-class; REG-68 minted+CLOSED). F3: admin_id is an actor
--   column (NOT NULL FK->users), so pin admin_id = auth.uid() per the inq_msg_insert pinned-actor
--   precedent (a tightening — an admin cannot forge a log attributed to another admin). UPDATE/DELETE
--   stay unpoliced (append-only RULES no_update_mod_log / no_delete_mod_log rewrite them to no-ops).
CREATE POLICY modlog_admin_insert ON betk.moderation_logs FOR INSERT
  WITH CHECK (betk.is_admin() AND admin_id = auth.uid());
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
-- CHECKOUT RPC — inquiry -> order (ADR-018, REG-49; Phase 07 / T02b)
-- Migration 20260723140552_order_payment_write_layer_reg49.sql.
--
-- SECURITY INVOKER (NOT DEFINER): every INSERT bites THROUGH the buyer, so
-- orders_insert + the RESTRICTIVE orders_phone_gate (OD-4 verified phone) +
-- order_items_insert + payments_insert + order_status_history_insert all enforce
-- naturally with no hand-rolled auth. PostgREST wraps one per-request transaction
-- => order + item + 2 payments + history commit or roll back together (AC-BUY-6).
-- A SECURITY DEFINER function granted to authenticated would add advisor 0029 —
-- forbidden by the "no new advisor findings" bar.
--
-- Amounts are SERVER-AUTHORITATIVE, never client-supplied: subtotal = listing.price
-- * qty; delivery_fee is RE-READ from admin_settings.delivery_fee_flat_egp (via the
-- settings_payment_config_read policy, invoker=buyer) — it is NEVER an rpc parameter
-- (the buyer only DISPLAYS it); total = subtotal + delivery_fee (chk_order_total);
-- 50/50 deposit/balance split computed in SQL. commission_rate/amount are stamped by
-- the BEFORE INSERT trigger set_order_commission_snapshot (the buyer never reads the
-- rate). converted_to_order_id is set by ADR-017's AFTER INSERT trigger. status
-- INSERTs 'pending' — NO auto-confirm (custodial deposit gate lives on the seller's
-- accept transition). The deposit leg must use a BETK electronic rail; cod is the
-- balance leg only.
--
-- UNPINNED ENGINEERING DECISION (cite-or-flag): nothing in the frozen scope pins
-- whether the flat delivery fee applies to pickup/remote delivery. This rpc applies
-- the flat fee UNIFORMLY to all delivery methods (the simplest server-authoritative
-- rule); revisit if a method-specific fee schedule is ever specced.
--
-- F4: the betk_ref (R-O02, BETK-YYYYMMDD-XXXX) uniqueness retry sits inside a plpgsql
-- BEGIN...EXCEPTION WHEN unique_violation block (implicit savepoint) — a bare retry
-- would run on an aborted transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION betk.create_order_from_inquiry(
  p_inquiry_id uuid,
  p_address_id uuid,
  p_delivery_method betk.delivery_preference,
  p_deposit_method betk.payment_method
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = betk, public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_inq      betk.inquiries;
  v_listing  betk.listings;
  v_qty      integer;
  v_unit     numeric;
  v_subtotal numeric;
  v_fee      numeric;
  v_total    numeric;
  v_deposit  numeric;
  v_balance  numeric;
  v_order_id uuid;
  v_ref      text;
  v_attempt  int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'BETK_UNAUTHENTICATED'; END IF;

  SELECT * INTO v_inq FROM betk.inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND OR v_inq.buyer_id <> v_uid THEN RAISE EXCEPTION 'BETK_INQUIRY_NOT_FOUND'; END IF;
  IF v_inq.status <> 'confirmed' THEN RAISE EXCEPTION 'BETK_INQUIRY_NOT_CONFIRMED'; END IF;
  IF v_inq.converted_to_order_id IS NOT NULL THEN RAISE EXCEPTION 'BETK_ALREADY_CONVERTED'; END IF;

  IF p_deposit_method NOT IN ('instapay','vodafone_cash','orange_cash') THEN
    RAISE EXCEPTION 'BETK_INVALID_DEPOSIT_METHOD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM betk.addresses a WHERE a.id = p_address_id AND a.buyer_id = v_uid) THEN
    RAISE EXCEPTION 'BETK_ADDRESS_NOT_FOUND';
  END IF;

  SELECT * INTO v_listing FROM betk.listings WHERE id = v_inq.listing_id;
  IF NOT FOUND OR v_listing.price IS NULL THEN RAISE EXCEPTION 'BETK_LISTING_UNPRICED'; END IF;

  v_qty      := COALESCE(v_inq.quantity, 1);
  v_unit     := v_listing.price;
  v_subtotal := round(v_unit * v_qty, 2);

  SELECT COALESCE(NULLIF(value,'')::numeric, 0) INTO v_fee
  FROM betk.admin_settings WHERE key = 'delivery_fee_flat_egp';
  v_fee   := COALESCE(v_fee, 0);

  v_total   := round(v_subtotal + v_fee, 2);
  v_deposit := round(v_total / 2, 2);
  v_balance := v_total - v_deposit;

  LOOP
    v_attempt := v_attempt + 1;
    v_ref := 'BETK-' || to_char(now() AT TIME ZONE 'UTC','YYYYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    BEGIN
      INSERT INTO betk.orders (betk_ref, buyer_id, store_id, inquiry_id, delivery_address_id,
                               delivery_method, delivery_fee, subtotal, total_amount, status)
      VALUES (v_ref, v_uid, v_inq.store_id, v_inq.id, p_address_id,
              p_delivery_method, v_fee, v_subtotal, v_total, 'pending')
      RETURNING id INTO v_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN RAISE EXCEPTION 'BETK_REF_RETRY_EXHAUSTED'; END IF;
    END;
  END LOOP;

  INSERT INTO betk.order_items (order_id, listing_id, listing_title_ar, quantity, unit_price, subtotal)
  VALUES (v_order_id, v_listing.id, v_listing.title_ar, v_qty, v_unit, v_subtotal);

  INSERT INTO betk.payments (order_id, payment_type, amount, method, status)
  VALUES (v_order_id, 'deposit', v_deposit, p_deposit_method, 'pending'),
         (v_order_id, 'balance', v_balance, 'cod',            'pending');

  INSERT INTO betk.order_status_history (order_id, from_status, to_status, changed_by, changed_by_type, notes)
  VALUES (v_order_id, NULL, 'pending', v_uid, 'buyer', 'order created');

  RETURN v_order_id;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method) TO authenticated;
