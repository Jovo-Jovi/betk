-- ============================================================
-- 0001_extensions_schemas_enums.sql
-- C3 Step 6 steps 001-003 + MVP-freeze auth_provider enum (OD-4).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
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
