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
