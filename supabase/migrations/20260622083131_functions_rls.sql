-- ============================================================
-- 0011_functions_rls.sql
-- C3 Step 6 steps 053-055: helper functions is_admin()/my_store_id() (defined
-- BEFORE the policies that use them), ENABLE RLS on all 43 tables, the RLS
-- policies, and the 3 MVP-freeze (OD-4) verified-phone transaction-gate
-- RESTRICTIVE policies (grouped with the other policies).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

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
-- SELLER_DOCUMENTS: own seller only; admin
CREATE POLICY sdoc_own ON betk.seller_documents FOR ALL
  USING (seller_id = auth.uid() OR betk.is_admin());
-- STORES: public read active; seller manages own
CREATE POLICY stores_public ON betk.stores FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid() OR betk.is_admin());
CREATE POLICY stores_manage ON betk.stores FOR UPDATE
  USING (seller_id = auth.uid() OR betk.is_admin());
-- CATEGORIES: public read
CREATE POLICY cat_public ON betk.categories FOR SELECT
  USING (is_active = TRUE OR betk.is_admin());
CREATE POLICY cat_admin ON betk.categories FOR ALL
  USING (betk.is_admin());
-- LISTINGS: public read active; seller manages own
CREATE POLICY listings_public ON betk.listings FOR SELECT
  USING (
    (status = 'active' AND deleted_at IS NULL)
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );
CREATE POLICY listings_seller ON betk.listings FOR ALL
  USING (store_id = betk.my_store_id() OR betk.is_admin());
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
