-- ============================================================
-- 20260716130533_reschedule_daily_cron_utc.sql
-- R3 — pg_cron timezone correction (DB/ops).
-- Source parity: docs/03-database/BETK_DATABASE_SCHEMA.sql (cron section).
--
-- WHY: pg_cron evaluates schedules in the cluster GUC `cron.timezone`, which on
-- this Supabase cluster is 'GMT'/UTC (pg_settings: context='postmaster',
-- source='default' — NOT settable persistently via SQL on hosted Supabase, so
-- the single-setting fix is unavailable). The 3 DAILY jobs were authored with
-- Cairo-local intent in their comments but stored as bare cron expressions, so
-- they fired ~2-3h off intent. This migration converts the 3 daily jobs to their
-- UTC equivalents.
--
-- DST: Egypt observes DST — UTC+2 in WINTER (standard) and UTC+3 in SUMMER
-- (roughly Apr-Oct). A single fixed UTC expression therefore lands ±1h across
-- seasons. We anchor each conversion on Egypt STANDARD time (UTC+2) so the job
-- hits its exact Cairo intent in winter and drifts +1h in summer; every chosen
-- time was verified to stay inside the overnight Cairo window (post-midnight,
-- ~00:00-04:00) in BOTH seasons.
--
-- Only the 3 DAILY jobs are touched. The hourly / 15-min jobs
-- (expire-boosts, dispute-sla-alert, cleanup-otp-tokens) are interval-based, not
-- wall-clock-local, so timezone is irrelevant to them — LEFT UNTOUCHED.
--
-- Command bodies are re-supplied VERBATIM from the original cron migration
-- (20260622083154_cron.sql); only the schedule (2nd arg) changes.
-- Job names are unchanged. cron.schedule upserts by name; we unschedule first
-- for an explicit, auditable replace.
-- ============================================================
SET search_path TO betk, public;

-- ------------------------------------------------------------
-- 2. recalculate-seller-levels
--    Intent:  ~02:00 Cairo (nightly seller level recalculation)
--    Old:     '0 2 * * *'  (bare -> fired 02:00 UTC = 04:00 winter / 05:00 summer Cairo)
--    New UTC:  '0 0 * * *'  (00:00 UTC)
--    -> Cairo WINTER (UTC+2): 02:00  (exact intent)
--    -> Cairo SUMMER (UTC+3): 03:00  (+1h; still overnight)
-- ------------------------------------------------------------
SELECT cron.unschedule('recalculate-seller-levels');
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

-- ------------------------------------------------------------
-- 3. daily-platform-snapshot
--    Intent:  ~00:05 Cairo (nightly analytics snapshot of the day that just ended)
--    Old:     '5 0 * * *'  (bare -> fired 00:05 UTC = 02:05 winter / 03:05 summer Cairo)
--    New UTC:  '5 22 * * *' (22:05 UTC)
--    -> Cairo WINTER (UTC+2): 00:05  (exact intent, just past midnight)
--    -> Cairo SUMMER (UTC+3): 01:05  (+1h; still just past midnight)
--    NOTE: 22:05 UTC is still within the SAME UTC calendar day (before UTC
--    midnight), so the body's CURRENT_DATE-1 accounting is unchanged from the
--    original 00:05-UTC firing: each UTC date still fires exactly once and
--    snapshots the fully-completed previous UTC date. Body is verbatim.
-- ------------------------------------------------------------
SELECT cron.unschedule('daily-platform-snapshot');
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

-- ------------------------------------------------------------
-- 5. lift-temp-suspensions
--    Intent:  ~03:00 Cairo (daily expiry of temporary suspensions)
--    Old:     '0 3 * * *'  (bare -> fired 03:00 UTC = 05:00 winter / 06:00 summer Cairo)
--    New UTC:  '0 1 * * *'  (01:00 UTC)
--    -> Cairo WINTER (UTC+2): 03:00  (exact intent)
--    -> Cairo SUMMER (UTC+3): 04:00  (+1h; still overnight)
-- ------------------------------------------------------------
SELECT cron.unschedule('lift-temp-suspensions');
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
