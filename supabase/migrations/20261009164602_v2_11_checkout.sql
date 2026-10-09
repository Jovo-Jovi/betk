-- P11M1. Replace checkout_from_cart. Not applied.
-- One migration transaction. No inner BEGIN or COMMIT. apply_migration
-- wraps this file. No new table. No policy. No phone predicate.
-- No admin_settings write. No escalation-column write.
-- Grants on checkout_from_cart are not in this file.
--
-- Live source, read-only, 2026-10-09: pg_get_functiondef of
-- betk.checkout_from_cart(uuid). md5 0df219d46dc1adb5503ee1388fbe8de3.
-- Length 9995. prosecdef false. search_path betk, public.
-- The replaced statement keeps that header. It does not say
-- SECURITY DEFINER, so the function stays SECURITY INVOKER.
--
-- checkout_refuse_inactive_store is the REG-115 reader. stores_public
-- shows a store only when status is active, or the caller owns it, or
-- the caller is admin. An invoker read cannot see another seller's
-- pending or suspended store, so the exception would not be raised.
-- The reader is SECURITY DEFINER, returns void, and raises
-- BETK_CHECKOUT_STORE_INACTIVE. It writes nothing. The rate lookup
-- below it is unchanged.
--
-- REG-113 charges cart_items.unit_price for fixed and custom lines.
-- D-81 sets display_ref to the successful master betk_ref, a hyphen,
-- and the 1-based store_id ascending position. Child betk_ref stays NULL.
-- REG-88 raises BETK_CHECKOUT_VERSION_UNCONFIGURED when buyer_terms or
-- return_policy is empty, and BETK_CHECKOUT_ACCEPTANCE_REQUIRED when
-- the buyer has no agreement_acceptances row for either current version.
-- seller_agreement and privacy are read and not required. This file
-- does not insert an acceptance.

CREATE OR REPLACE FUNCTION betk.checkout_refuse_inactive_store()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    JOIN betk.stores AS s ON s.id = l.store_id
    WHERE c.buyer_id = auth.uid()
      AND s.status <> 'active'
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_STORE_INACTIVE';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_refuse_inactive_store() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_refuse_inactive_store() TO authenticated;

CREATE OR REPLACE FUNCTION betk.checkout_from_cart(p_delivery_address_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_minutes integer;
  v_mult numeric;
  v_terms text;
  v_seller_agreement text;
  v_return_policy text;
  v_privacy text;
  v_gov character varying(50);
  v_city character varying(100);
  v_street text;
  v_notes text;
  v_master_id uuid;
  v_ref text;
  v_attempt integer := 0;
  v_ids uuid[] := '{}';
  v_stores uuid[] := '{}';
  v_weights integer[] := '{}';
  v_subs numeric[] := '{}';
  v_fees numeric[] := '{}';
  v_rates uuid[] := '{}';
  v_child numeric[] := '{}';
  v_deposit numeric[] := '{}';
  v_balance numeric[] := '{}';
  v_floor numeric[] := '{}';
  v_master_total numeric(10,2);
  v_fee_total numeric(10,2);
  v_floor_sum numeric(10,2) := 0;
  v_master_deposit numeric(10,2);
  v_leftover integer;
  v_ranked uuid[];
  v_extra uuid[] := '{}';
  v_one_rate uuid;
  v_one_fee numeric;
  r record;
  i integer;
  n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  v_minutes := betk.checkout_payment_window_minutes();
  v_mult := betk.checkout_quote_multiplier();

  -- REG-88. Gate buyer_terms and return_policy. The other two are read and not required.
  v_terms := betk.checkout_agreement_version('agreement_buyer_terms_version');
  v_seller_agreement := betk.checkout_agreement_version('agreement_seller_agreement_version');
  v_return_policy := betk.checkout_agreement_version('agreement_return_policy_version');
  v_privacy := betk.checkout_agreement_version('agreement_privacy_version');
  IF v_terms IS NULL OR btrim(v_terms) = ''
     OR v_return_policy IS NULL OR btrim(v_return_policy) = '' THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_VERSION_UNCONFIGURED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM betk.agreement_acceptances AS aa
    WHERE aa.user_id = v_uid
      AND aa.document = 'buyer_terms'
      AND aa.version_label = v_terms
  ) OR NOT EXISTS (
    SELECT 1
    FROM betk.agreement_acceptances AS aa
    WHERE aa.user_id = v_uid
      AND aa.document = 'return_policy'
      AND aa.version_label = v_return_policy
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED';
  END IF;

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
    WHERE c.buyer_id = v_uid
      AND NOT EXISTS (
        SELECT 1
        FROM betk.listings AS l
        WHERE l.id = c.listing_id
          AND l.weight_g IS NOT NULL
          AND l.deleted_at IS NULL
          AND l.status IN ('active', 'sold_out')
          AND (
            (c.is_custom AND l.price IS NOT NULL)
            OR (NOT c.is_custom AND l.price IS NOT NULL)
          )
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_LINE_UNRESOLVED';
  END IF;

  PERFORM betk.checkout_refuse_inactive_store();

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
    WHERE c.buyer_id = v_uid
      AND c.is_custom
      AND (
        q.id IS NULL
        OR q.buyer_id <> v_uid
        OR q.listing_id <> c.listing_id
        OR q.quoted_price IS NULL
        OR q.quote_expires_at IS NULL
        OR q.quote_expires_at <= now()
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_QUOTE_EXPIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    JOIN betk.inquiries AS q ON q.id = c.inquiry_id
    WHERE c.buyer_id = v_uid
      AND c.is_custom
      AND (
        q.quoted_price < l.price
        OR q.quoted_price > l.price * v_mult
      )
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_QUOTE_OUT_OF_BAND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    WHERE c.buyer_id = v_uid
      AND l.stock_qty IS NOT NULL
      AND l.stock_qty < c.quantity
  ) THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_OUT_OF_STOCK';
  END IF;

  FOR r IN
    SELECT
      gen_random_uuid() AS seller_order_id,
      g.store_id,
      g.weight_g,
      g.subtotal
    FROM (
      SELECT
        l.store_id,
        sum(l.weight_g * c.quantity)::integer AS weight_g,
        sum(c.quantity * c.unit_price) AS subtotal
      FROM betk.cart_items AS c
      JOIN betk.listings AS l ON l.id = c.listing_id
      LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
      WHERE c.buyer_id = v_uid
      GROUP BY l.store_id
    ) AS g
    ORDER BY g.store_id ASC
  LOOP
    v_ids := v_ids || r.seller_order_id;
    v_stores := v_stores || r.store_id;
    v_weights := v_weights || r.weight_g;
    v_subs := v_subs || r.subtotal;
  END LOOP;

  n := coalesce(array_length(v_ids, 1), 0);
  IF n = 0 THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_EMPTY_CART';
  END IF;

  FOR i IN 1..n LOOP
    v_one_rate := NULL;
    v_one_fee := NULL;
    SELECT cr.id, cr.fee_egp
      INTO v_one_rate, v_one_fee
    FROM betk.stores AS s
    JOIN betk.courier_rates AS cr
      ON cr.origin_governorate = s.governorate
     AND cr.destination_governorate = v_gov
     AND cr.weight_min_g <= v_weights[i]
     AND (cr.weight_max_g IS NULL OR v_weights[i] < cr.weight_max_g)
    WHERE s.id = v_stores[i];
    IF v_one_rate IS NULL THEN
      RAISE EXCEPTION 'BETK_CHECKOUT_RATE_MISSING';
    END IF;
    v_rates := v_rates || v_one_rate;
    v_fees := v_fees || v_one_fee;
    v_child := v_child || (v_subs[i] + v_one_fee);
    v_floor := v_floor || trunc((v_subs[i] + v_one_fee) / 2, 2);
  END LOOP;

  v_master_total := 0;
  v_fee_total := 0;
  v_floor_sum := 0;
  FOR i IN 1..n LOOP
    v_master_total := v_master_total + v_child[i];
    v_fee_total := v_fee_total + v_fees[i];
    v_floor_sum := v_floor_sum + v_floor[i];
  END LOOP;
  v_master_deposit := round(v_master_total / 2, 2);
  v_leftover := round((v_master_deposit - v_floor_sum) * 100)::integer;

  SELECT array_agg(u.seller_order_id ORDER BY u.remainder DESC, u.seller_order_id ASC)
    INTO v_ranked
  FROM (
    SELECT
      v_ids[g.idx] AS seller_order_id,
      (v_child[g.idx] / 2) - v_floor[g.idx] AS remainder
    FROM generate_subscripts(v_ids, 1) AS g(idx)
  ) AS u;

  IF v_leftover >= 1 THEN
    FOR i IN 1..least(v_leftover, coalesce(array_length(v_ranked, 1), 0)) LOOP
      v_extra := v_extra || v_ranked[i];
    END LOOP;
  END IF;

  v_deposit := '{}';
  v_balance := '{}';
  FOR i IN 1..n LOOP
    v_deposit := v_deposit || (
      v_floor[i] + CASE
        WHEN v_ids[i] = ANY (v_extra) THEN 0.01
        ELSE 0
      END
    );
    v_balance := v_balance || (
      v_child[i] - v_floor[i] - CASE
        WHEN v_ids[i] = ANY (v_extra) THEN 0.01
        ELSE 0
      END
    );
  END LOOP;

  LOOP
    v_attempt := v_attempt + 1;
    v_ref := 'BETK-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    BEGIN
      INSERT INTO betk.master_orders (
        buyer_id,
        betk_ref,
        delivery_address_id,
        recipient_name,
        recipient_phone,
        snapshot_governorate,
        snapshot_city,
        snapshot_street_address,
        snapshot_building_notes,
        combined_delivery_total,
        payment_deadline
      ) VALUES (
        v_uid,
        v_ref,
        p_delivery_address_id,
        NULL,
        NULL,
        v_gov,
        v_city,
        v_street,
        v_notes,
        v_fee_total,
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
    id,
    buyer_id,
    store_id,
    inquiry_id,
    delivery_address_id,
    delivery_method,
    delivery_fee,
    subtotal,
    total_amount,
    status,
    master_order_id,
    betk_ref,
    display_ref,
    courier_rate_id
  )
  SELECT
    u.id,
    v_uid,
    u.store_id,
    NULL,
    p_delivery_address_id,
    'delivery'::betk.delivery_preference,
    u.fee,
    u.subtotal,
    u.child_total,
    'pending'::betk.order_status,
    v_master_id,
    NULL,
    v_ref || '-' || u.n::text,
    u.rate_id
  FROM unnest(v_ids, v_stores, v_fees, v_subs, v_child, v_rates)
    WITH ORDINALITY AS u(id, store_id, fee, subtotal, child_total, rate_id, n);

  INSERT INTO betk.order_items (
    order_id,
    listing_id,
    listing_title_ar,
    quantity,
    unit_price,
    subtotal,
    is_custom,
    inquiry_id,
    prep_days_snapshot
  )
  SELECT
    ch.id,
    l.id,
    l.title_ar,
    c.quantity,
    c.unit_price,
    c.quantity * c.unit_price,
    c.is_custom,
    CASE WHEN c.is_custom THEN c.inquiry_id ELSE NULL END,
    CASE WHEN c.is_custom THEN q.quoted_prep_days ELSE l.prep_days END
  FROM betk.cart_items AS c
  JOIN betk.listings AS l ON l.id = c.listing_id
  JOIN unnest(v_ids, v_stores) AS ch(id, store_id)
    ON ch.store_id = l.store_id
  LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
  WHERE c.buyer_id = v_uid;

  INSERT INTO betk.payments (order_id, payment_type, amount, method, status)
  SELECT u.id, 'deposit'::betk.payment_type, u.deposit, 'instapay'::betk.payment_method, 'pending'::betk.payment_status
  FROM unnest(v_ids, v_deposit) AS u(id, deposit)
  WHERE u.deposit > 0
  UNION ALL
  SELECT u.id, 'balance'::betk.payment_type, u.balance, 'cod'::betk.payment_method, 'pending'::betk.payment_status
  FROM unnest(v_ids, v_balance) AS u(id, balance)
  WHERE u.balance > 0;

  -- FLAG-COURIER. The matrix row has no name. The id is the value taken
  -- from the matched band.
  INSERT INTO betk.shipments (order_id, courier)
  SELECT u.id, u.rate_id::text
  FROM unnest(v_ids, v_rates) AS u(id, rate_id);

  INSERT INTO betk.order_status_history (
    order_id, from_status, to_status, changed_by, changed_by_type, notes
  )
  SELECT u.id, NULL::betk.order_status, 'pending'::betk.order_status, v_uid, 'buyer'::betk.cancelled_by_type, 'order created'
  FROM unnest(v_ids) AS u(id);

  DELETE FROM betk.cart_items WHERE buyer_id = v_uid;

  RETURN v_master_id;
END;
$function$;
