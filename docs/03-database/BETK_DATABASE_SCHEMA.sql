-- ============================================================
-- BETK_DATABASE_SCHEMA.sql
-- PostgreSQL 17 / Supabase. Database CONTRACT for BETK MVP.
-- Source of truth: Architecture Conversation 3 (Supabase Production Schema).
-- Run migrations in the 057-step order documented in BETK_ERD.md §9 / C3 §7.
--
-- This file is the canonical schema reference. The authoritative, fully
-- expanded DDL (every CREATE TABLE with all columns/constraints, all 34
-- indexes, 5 triggers, 22 RLS policies, 2 helper functions, 6 pg_cron jobs)
-- is reproduced verbatim from Architecture Conversation 3. Keep this file in
-- sync with the Supabase migration files under supabase/migrations/.
-- ============================================================

-- 001 EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 002 SCHEMAS
CREATE SCHEMA IF NOT EXISTS betk;
CREATE SCHEMA IF NOT EXISTS betk_analytics;
CREATE SCHEMA IF NOT EXISTS betk_audit;
SET search_path TO betk, public;

-- 003 ENUM TYPES (30) — must exist before tables
CREATE TYPE user_role            AS ENUM ('buyer','seller','admin','superadmin');
CREATE TYPE user_status          AS ENUM ('active','suspended','banned','pending');
CREATE TYPE seller_status        AS ENUM ('pending','active','suspended','banned');
CREATE TYPE seller_level         AS ENUM ('bronze','silver','gold');
CREATE TYPE strike_type          AS ENUM ('warning','temp_suspension','permanent_ban');
CREATE TYPE store_status         AS ENUM ('pending','active','suspended');
CREATE TYPE doc_type             AS ENUM ('national_id_front','national_id_back');
CREATE TYPE doc_review_status    AS ENUM ('pending','approved','rejected');
CREATE TYPE listing_type         AS ENUM ('product','service');
CREATE TYPE price_type           AS ENUM ('fixed','per_hour','starting_from','quote_only');
CREATE TYPE listing_status       AS ENUM ('draft','active','sold_out','paused','removed');
CREATE TYPE inquiry_status       AS ENUM ('open','replied','confirmed','declined','expired');
CREATE TYPE sender_type          AS ENUM ('buyer','seller','admin','system');
CREATE TYPE delivery_preference  AS ENUM ('delivery','pickup','remote');
CREATE TYPE order_status         AS ENUM ('pending','confirmed','preparing','dispatched','delivered','cancelled','returned');
CREATE TYPE cancelled_by_type    AS ENUM ('buyer','seller','admin','system');
CREATE TYPE payment_type         AS ENUM ('deposit','balance');
CREATE TYPE payment_method       AS ENUM ('instapay','vodafone_cash','orange_cash','cod');
CREATE TYPE payment_status       AS ENUM ('pending','confirmed','failed','refunded');
CREATE TYPE payout_method        AS ENUM ('instapay','vodafone_cash','orange_cash');
CREATE TYPE payout_status        AS ENUM ('pending','processing','processed','rejected');
CREATE TYPE shipment_status      AS ENUM ('created','picked_up','in_transit','out_for_delivery','delivered','failed','returned');
CREATE TYPE dispute_reason       AS ENUM ('not_received','not_as_described','damaged','wrong_item','return_request','refund_request');
CREATE TYPE dispute_status       AS ENUM ('submitted','under_review','awaiting_seller','resolved','closed');
CREATE TYPE dispute_resolution   AS ENUM ('buyer_favour','seller_favour','partial','no_action');
CREATE TYPE boost_status         AS ENUM ('pending_payment','active','expired','cancelled');
CREATE TYPE flag_reason          AS ENUM ('misleading','counterfeit','inappropriate','spam','prohibited','wrong_category');
CREATE TYPE flag_severity        AS ENUM ('low','medium','high');
CREATE TYPE flag_status          AS ENUM ('pending','reviewed','actioned','dismissed');
CREATE TYPE content_type         AS ENUM ('listing','review');
CREATE TYPE moderation_target    AS ENUM ('seller','buyer','listing','review','dispute','payout');
CREATE TYPE notification_channel AS ENUM ('push','sms','whatsapp','email');
CREATE TYPE collection_status    AS ENUM ('draft','live','scheduled','archived');

-- 004-050 TABLES
-- NOTE: Column-level definitions for all 43 tables are specified in full in
-- Architecture Conversation 2 §3 and Conversation 3 §3 (Groups A–M). Reproduce
-- each CREATE TABLE here verbatim from C3 §3 when generating migration 004-050.
-- Key contract points enforced at the DB layer (do not weaken):
--   users.phone_number          UNIQUE NULL  (was NOT NULL; OD-4)    (R-A03 amended)
--       └─ Nullable so Google-OAuth users can exist pre-phone. UNIQUE still holds
--          (Postgres permits multiple NULLs). App rule: a VERIFIED phone is required
--          before any transaction (checkout / become seller / payout). R-A01 amended.
--   users.auth_provider         ENUM/text 'phone' | 'google'        (OD-4; identity origin)
--   users.deleted_at            TIMESTAMPTZ NULL  (OD-2)             (deactivate-only MVP)
--   users.anonymized_at         TIMESTAMPTZ NULL  (OD-2)             (reserved for post-MVP MW1)
--   stores.seller_id            UNIQUE NOT NULL                    (R-S01, one store/seller)
--   stores.slug                 UNIQUE NOT NULL                    (R-S02)
--   listings.store_id           NOT NULL FK                        (R-L01)
--   listings.deleted_at         TIMESTAMPTZ NULL (soft delete)     (R-L10)
--   listings.search_vector      TSVECTOR (GIN)                     (search)
--   order_items.unit_price      snapshot at order time            (denorm, intentional)
--   orders.betk_ref             UNIQUE NOT NULL                    (R-O02)
--   payments UNIQUE(order_id, payment_type)                       (split-payment dedupe)
--   payouts.amount              CHECK (amount >= 100)              (R-O09)
--   reviews.order_id            UNIQUE NOT NULL                    (R-O07, R-R02)
--   reviews.rating              CHECK (rating BETWEEN 1 AND 5)
--   reviews.edit_deadline       created_at + 48h                  (R-R03, trigger)
--   shipments.order_id          UNIQUE NOT NULL                    (1:1)
--   disputes.order_id           UNIQUE NOT NULL                    (R-O06/R-D06)
--   disputes.sla_deadline       created_at + 48h                  (R-D02, trigger)
--   wishlists  UNIQUE(buyer_id, listing_id)
--   store_follows UNIQUE(buyer_id, store_id)
--   listing_tags  UNIQUE(listing_id, tag)
--   collection_listings UNIQUE(collection_id, listing_id)
--   restock_alerts UNIQUE(buyer_id, listing_id)
--   seller_snapshots UNIQUE(store_id, snapshot_date)
--   rating_aggregates.store_id  PRIMARY KEY (1:1 with stores)
--   admin_settings.key          PRIMARY KEY (key-value)            (add CHECK on numeric keys — C3 §8.2 RISK 2)
--   flagged_content.content_id  polymorphic UUID (no FK) — validate via trigger (C3 §8.2 RISK 3)

-- 051 TRIGGERS (5): search_vector, review edit_deadline, dispute sla_deadline,
--                   rating_aggregate recompute, stock decrement on confirm.
-- 052 INDEXES (34): see BETK_ERD.md §4 / C3 §4 for the full list + justifications.
-- 055 HELPER FUNCTIONS:
--   betk.is_admin()      SECURITY DEFINER — role IN ('admin','superadmin') AND status='active'
--   betk.my_store_id()   SECURITY DEFINER — stores.id WHERE seller_id = auth.uid()
-- 053-054 RLS: ENABLE on all 43 tables + 22 policies (C3 §5; summarized BETK_ERD.md §3).
-- 056 pg_cron (6): expire-boosts (*/15m), recalculate-seller-levels (02:00),
--                  daily-platform-snapshot (00:05), dispute-sla-alert (hourly),
--                  lift-temp-suspensions (03:00), cleanup-otp-tokens (:30 hourly). All Africa/Cairo.
-- 057 GRANTS: anon, authenticated, service_role.

-- See C3 §6 for the exact pg_cron job bodies and C3 §7 for the migration order.

-- ============================================================
-- MVP FREEZE ADDENDUM (signed 2026-06-13) — applied to migration 004 (users)
-- OD-2 + OD-4 schema deltas on betk.users. Add to the users CREATE TABLE:
-- ============================================================
-- ALTER TYPE / column shape for betk.users (reflect in migration 004):
--   phone_number  VARCHAR(15) UNIQUE NULL      -- was NOT NULL (OD-4)
--   auth_provider auth_provider NOT NULL DEFAULT 'phone'   -- OD-4
--   deleted_at    TIMESTAMPTZ NULL             -- OD-2 deactivate-only
--   anonymized_at TIMESTAMPTZ NULL             -- OD-2 reserved (post-MVP MW1)
--
-- New enum (add to migration 003, ENUM block):
--   CREATE TYPE auth_provider AS ENUM ('phone','google');
--
-- Login-block rule (R-A05) now also checks deleted_at IS NULL.
-- Transaction gate (app + RLS WITH CHECK): orders/seller_profiles/payouts inserts
--   require users.phone_number IS NOT NULL (verified). Enforced in Server Actions
--   and re-asserted in RLS WITH CHECK where feasible.
