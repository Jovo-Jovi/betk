-- ============================================================
-- 0010_indexes.sql
-- C3 Step 6 step 052: all secondary indexes (Section 4 of the source schema).
-- The partial-unique guard uq_active_boost_per_listing is created inline in
-- 0008 (as in the source) and is NOT duplicated here.
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

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
-- Partial unique already created in 0008 (uq_active_boost_per_listing)
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
