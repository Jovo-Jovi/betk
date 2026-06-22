-- ============================================================
-- 0012_cron.sql
-- C3 Step 6 step 056: 6 pg_cron scheduled jobs. All times Cairo (Africa/Cairo = UTC+3).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- 1. Expire boost listings every 15 minutes
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

-- 2. Nightly seller level recalculation at 02:00 Cairo
SELECT cron.schedule(
  'recalculate-seller-levels',
  '0 2 * * *',
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

-- 3. Nightly analytics snapshot at 00:05 Cairo
SELECT cron.schedule(
  'daily-platform-snapshot',
  '5 0 * * *',
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

-- 5. Expire temporary suspensions daily at 03:00 Cairo
SELECT cron.schedule(
  'lift-temp-suspensions',
  '0 3 * * *',
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
