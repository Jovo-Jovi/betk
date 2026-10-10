-- P11M3. Payment-window sweeper. Not applied.
-- One new function and one pg_cron job. This file does not replace
-- checkout_from_cart, checkout_delivery_preview, enforce_order_transition,
-- or restore_stock_on_cancel. No new table, column, or enum member.
-- No settings write.
--
-- Live reads, 2026-10-10, read-only:
-- pg_cron extversion 1.6.4, schema pg_catalog.
-- cron.schedule(job_name text, schedule text, command text) is the C
-- symbol cron_schedule_named. Unique index jobname_username_uniq is on
-- cron.job (jobname, username).
-- betk.enforce_order_transition() pg_get_functiondef md5
-- 235f515602bc1531f3a3f44a24515ab8. The no-JWT system branch is lines
-- 48-52 of that definition. Line 52 stamps cancelled_by system.
-- betk.restore_stock_on_cancel() pg_get_functiondef md5
-- 037aacbdb3820d1f98dd259993f16593. The stock update is line 20.
-- The fixed cart insert is line 37 (inquiry_id IS NULL, line 43).
-- The custom cart insert requires quote_expires_at > now() (line 53).
-- betk.order_status label pending is pg_enum sort 1.
-- notification_channel label sms is pg_enum sort 2.
-- Ledger 44, last 20261010072302. This file is not a 45th row.
--
-- sweep_expired_payment_windows is SECURITY DEFINER.
-- search_path is betk, public, the same SET as enforce_order_transition.
-- EXECUTE is revoked from PUBLIC, anon, and authenticated.
-- The cron command only calls this function.
-- Job name: sweep-expired-payment-windows. Schedule: * * * * *.
-- pg_cron 1.6.4 schedule-by-name updates the existing job. The v1.6.4
-- README schedules nightly-vacuum a second time and the returned job id
-- stays 43. Re-running this file does not insert a second job.
--
-- R-SWEEP-HISTORY (planning chat, 2026-10-10). The cancel and its
-- history are one statement. Each cancelled child gets one
-- order_status_history row: from_status pending, to_status cancelled,
-- changed_by NULL, changed_by_type system, notes payment_window_expired.
-- Columns: 20260622082857_messaging_orders.sql lines 110-119.
-- changed_by_type is cancelled_by_type. The value system is
-- 20260622082729_extensions_schemas_enums.sql line 48.
-- The notification guard and insert are unchanged.
-- R-SWEEP-ISOLATE (planning chat, 2026-10-10). Each master is its own
-- BEGIN block. On error, RAISE WARNING names the master id, SQLSTATE,
-- and SQLERRM, then the next master runs. That master's partial work
-- rolls back with its block. The run completes. Locking, selection,
-- ordering, LIMIT 100, the re-check, the REVOKE, and cron.schedule
-- are unchanged.

CREATE OR REPLACE FUNCTION betk.sweep_expired_payment_windows()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_master_id uuid;
  v_buyer uuid;
  v_ref text;
  v_cancelled integer;
BEGIN
  FOR v_master_id IN
    SELECT m.id
    FROM betk.master_orders AS m
    WHERE m.payment_deadline IS NOT NULL
      AND m.payment_deadline < now()
      AND m.proof_path IS NULL
      AND EXISTS (
        SELECT 1
        FROM betk.seller_orders AS s
        WHERE s.master_order_id = m.id
          AND s.status = 'pending'::betk.order_status
      )
    ORDER BY m.payment_deadline ASC
    LIMIT 100
    FOR UPDATE OF m SKIP LOCKED
  LOOP
    BEGIN
      SELECT m.buyer_id, m.betk_ref
        INTO v_buyer, v_ref
      FROM betk.master_orders AS m
      WHERE m.id = v_master_id
        AND m.proof_path IS NULL
        AND m.payment_deadline IS NOT NULL
        AND m.payment_deadline < now();
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      -- R-SWEEP-HISTORY. One statement. Column list is
      -- 20260622082857_messaging_orders.sql lines 110-119.
      -- cancelled_by_type value system is
      -- 20260622082729_extensions_schemas_enums.sql line 48.
      WITH cancelled AS (
        UPDATE betk.seller_orders AS s
        SET status = 'cancelled'::betk.order_status
        WHERE s.master_order_id = v_master_id
          AND s.status = 'pending'::betk.order_status
        RETURNING s.id
      )
      INSERT INTO betk.order_status_history (
        order_id, from_status, to_status, changed_by, changed_by_type, notes
      )
      SELECT
        c.id,
        'pending'::betk.order_status,
        'cancelled'::betk.order_status,
        NULL,
        'system'::betk.cancelled_by_type,
        'payment_window_expired'
      FROM cancelled AS c;

      GET DIAGNOSTICS v_cancelled = ROW_COUNT;
      IF v_cancelled = 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO betk.notifications (user_id, type, channel, body, data)
      SELECT
        v_buyer,
        'payment_window_expired',
        'sms',
        'BETK Alert: Order #' || v_ref || ' payment window expired.',
        jsonb_build_object('master_order_id', v_master_id, 'betk_ref', v_ref)
      WHERE NOT EXISTS (
        SELECT 1
        FROM betk.notifications AS n
        WHERE n.user_id = v_buyer
          AND n.type = 'payment_window_expired'
          AND n.data->>'master_order_id' = v_master_id::text
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'sweep_expired_payment_windows master % SQLSTATE % SQLERRM %',
          v_master_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.sweep_expired_payment_windows() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'sweep-expired-payment-windows',
  '* * * * *',
  $$SELECT betk.sweep_expired_payment_windows()$$
);
