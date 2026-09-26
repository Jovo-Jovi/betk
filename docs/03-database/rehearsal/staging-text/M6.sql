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

-- Argument list is not a fenced DRAFT block. Smallest shape the pinned
-- sentences allow: no delivery-method argument, no money arguments, the
-- address is required for the snapshot, the return is the new master id.
-- Checks out every cart line for auth.uid(). Fee is the courier_rates band
-- for the seller's summed weight (half-open upper bound, matching the M2
-- exclusion). Null weight or a missing band raises and writes nothing.
-- Line price is listing.price, or inquiries.quoted_price when the line is
-- custom. display_ref stays NULL (REG-81 format is open). Child betk_ref
-- stays NULL. Deposit method is instapay and balance method is cod (ERD §6.3).
-- Stock update is the live decrement body plus stock_touched_at, inlined
-- because that function is a trigger function (NEW) and cannot be called
-- as an RPC. Agreement keys are not consulted (REG-88 is not pinned).
CREATE FUNCTION betk.checkout_from_cart(p_delivery_address_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_window text;
  v_minutes integer;
  v_gov varchar(50);
  v_city varchar(100);
  v_street text;
  v_notes text;
  v_master_id uuid;
  v_ref text;
  v_attempt integer := 0;
  v_master_total numeric(10,2);
  v_master_deposit numeric(10,2);
  v_fee_total numeric(10,2);
  v_leftover integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  SELECT value INTO v_window
  FROM betk.admin_settings
  WHERE key = 'payment_window_minutes';
  IF v_window IS NULL OR btrim(v_window) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_PAYMENT_WINDOW_UNCONFIGURED';
  END IF;
  v_minutes := v_window::integer;

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
    JOIN betk.listings AS l ON l.id = c.listing_id
    LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
    WHERE c.buyer_id = v_uid
      AND (
        l.weight_g IS NULL
        OR (c.is_custom AND (q.id IS NULL OR q.buyer_id <> v_uid OR q.quoted_price IS NULL))
        OR (NOT c.is_custom AND l.price IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_LINE_UNRESOLVED';
  END IF;

  DROP TABLE IF EXISTS pg_temp.checkout_child;
  CREATE TEMP TABLE checkout_child (
    seller_order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    weight_g integer NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    fee numeric(10,2),
    child_total numeric(10,2),
    floor_deposit numeric(10,2),
    remainder numeric,
    deposit numeric(10,2),
    balance numeric(10,2)
  ) ON COMMIT DROP;

  INSERT INTO checkout_child (seller_order_id, store_id, weight_g, subtotal)
  SELECT
    gen_random_uuid(),
    l.store_id,
    sum(l.weight_g * c.quantity)::integer,
    sum(c.quantity * CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END)
  FROM betk.cart_items AS c
  JOIN betk.listings AS l ON l.id = c.listing_id
  LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
  WHERE c.buyer_id = v_uid
  GROUP BY l.store_id;

  UPDATE checkout_child AS ch
  SET fee = r.fee_egp
  FROM betk.stores AS s, betk.courier_rates AS r
  WHERE s.id = ch.store_id
    AND r.origin_governorate = s.governorate
    AND r.destination_governorate = v_gov
    AND r.weight_min_g <= ch.weight_g
    AND (r.weight_max_g IS NULL OR ch.weight_g < r.weight_max_g);

  IF EXISTS (SELECT 1 FROM checkout_child WHERE fee IS NULL) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_RATE_MISSING';
  END IF;

  UPDATE checkout_child
  SET child_total = subtotal + fee,
      floor_deposit = trunc((subtotal + fee) / 2, 2),
      remainder = ((subtotal + fee) / 2) - trunc((subtotal + fee) / 2, 2);

  SELECT sum(child_total), sum(fee)
    INTO v_master_total, v_fee_total
  FROM checkout_child;
  v_master_deposit := round(v_master_total / 2, 2);
  v_leftover := round((v_master_deposit - (SELECT sum(floor_deposit) FROM checkout_child)) * 100);

  UPDATE checkout_child AS ch
  SET deposit = ch.floor_deposit + CASE WHEN ranked.rn <= v_leftover THEN 0.01 ELSE 0 END,
      balance = ch.child_total - (ch.floor_deposit + CASE WHEN ranked.rn <= v_leftover THEN 0.01 ELSE 0 END)
  FROM (
    SELECT seller_order_id,
           row_number() OVER (ORDER BY remainder DESC, seller_order_id ASC) AS rn
    FROM checkout_child
  ) AS ranked
  WHERE ranked.seller_order_id = ch.seller_order_id;

  IF (SELECT sum(deposit) FROM checkout_child) IS DISTINCT FROM v_master_deposit
     OR EXISTS (
       SELECT 1 FROM checkout_child
       WHERE deposit + balance IS DISTINCT FROM child_total
     ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_ALLOCATION';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_ref := 'BETK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    BEGIN
      INSERT INTO betk.master_orders (
        buyer_id, betk_ref, delivery_address_id,
        recipient_name, recipient_phone,
        snapshot_governorate, snapshot_city, snapshot_street_address, snapshot_building_notes,
        combined_delivery_total, proof_path, transfer_reference, proof_uploaded_at,
        payment_deadline
      ) VALUES (
        v_uid, v_ref, p_delivery_address_id,
        NULL, NULL,
        v_gov, v_city, v_street, v_notes,
        v_fee_total, NULL, NULL, NULL,
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
    id, buyer_id, store_id, inquiry_id, delivery_address_id,
    delivery_method, delivery_fee, subtotal, total_amount,
    status, master_order_id, betk_ref, display_ref
  )
  SELECT
    ch.seller_order_id, v_uid, ch.store_id, NULL, p_delivery_address_id,
    'delivery', ch.fee, ch.subtotal, ch.child_total,
    'pending', v_master_id, NULL, NULL
  FROM checkout_child AS ch;

  INSERT INTO betk.order_items (
    order_id, listing_id, listing_title_ar, quantity, unit_price, subtotal,
    is_custom, inquiry_id, prep_days_snapshot
  )
  SELECT
    ch.seller_order_id,
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
  JOIN checkout_child AS ch ON ch.store_id = l.store_id
  LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
  WHERE c.buyer_id = v_uid;

  INSERT INTO betk.payments (order_id, payment_type, amount, method, status)
  SELECT ch.seller_order_id, 'deposit', ch.deposit, 'instapay', 'pending'
  FROM checkout_child AS ch
  UNION ALL
  SELECT ch.seller_order_id, 'balance', ch.balance, 'cod', 'pending'
  FROM checkout_child AS ch;

  INSERT INTO betk.shipments (order_id, courier)
  SELECT ch.seller_order_id, 'courier'
  FROM checkout_child AS ch;

  INSERT INTO betk.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_type, notes
  )
  SELECT ch.seller_order_id, NULL, 'pending', v_uid, 'buyer', 'order created'
  FROM checkout_child AS ch;

  UPDATE betk.listings AS l
  SET stock_qty = l.stock_qty - oi.qty,
      status = CASE
        WHEN l.stock_qty - oi.qty = 0 AND l.status = 'active'
        THEN 'sold_out'::betk.listing_status
        ELSE l.status
      END,
      stock_touched_at = now(),
      updated_at = now()
  FROM (
    SELECT i.listing_id, sum(i.quantity)::integer AS qty
    FROM betk.order_items AS i
    JOIN checkout_child AS ch ON ch.seller_order_id = i.order_id
    GROUP BY i.listing_id
  ) AS oi
  WHERE l.id = oi.listing_id
    AND l.stock_qty IS NOT NULL;

  DELETE FROM betk.cart_items WHERE buyer_id = v_uid;

  RETURN v_master_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_from_cart(uuid) FROM PUBLIC, anon, authenticated;
