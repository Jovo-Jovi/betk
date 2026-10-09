-- P11M2. Read-only delivery preview. Not applied.
-- One new function. This file does not replace checkout_from_cart
-- and does not alter any other existing object.
-- No new table. No policy. No settings write.
--
-- Live source, read-only, 2026-10-09: pg_get_functiondef of
-- betk.checkout_from_cart(uuid). md5 fb7b8b6965a3988be4a57ef8112f2130.
-- Length 10594. prosecdef false. provolatile v. search_path betk, public.
--
-- checkout_delivery_preview is SECURITY INVOKER and STABLE.
-- search_path is betk, public, the same SET as P11M1.
-- STABLE makes Postgres refuse INSERT, UPDATE, DELETE, and
-- SELECT FOR UPDATE/SHARE in this body. The cart read has no FOR UPDATE.
-- EXECUTE is granted to authenticated. PUBLIC and anon are revoked.
--
-- In: the delivery address id. Out: one numeric(10,2), the combined
-- delivery total. No per-seller fee is returned (R-K03).
--
-- Refusal codes are checkout's, in the expansion's sequence.
-- Stock, quote expiry, and the REG-88 gate are not in this function.
-- The weight sum, the governorate match, the band predicate, and the
-- fee sum are checkout's expressions.

CREATE OR REPLACE FUNCTION betk.checkout_delivery_preview(p_delivery_address_id uuid)
 RETURNS numeric(10,2)
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_gov character varying(50);
  v_stores uuid[] := '{}';
  v_weights integer[] := '{}';
  v_fees numeric[] := '{}';
  v_fee_total numeric(10,2);
  v_one_rate uuid;
  v_one_fee numeric;
  r record;
  i integer;
  n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  PERFORM 1
  FROM betk.cart_items
  WHERE buyer_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_EMPTY_CART';
  END IF;

  SELECT a.governorate
    INTO v_gov
  FROM betk.addresses AS a
  WHERE a.id = p_delivery_address_id
    AND a.buyer_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_ADDRESS_NOT_FOUND';
  END IF;

  PERFORM betk.checkout_refuse_inactive_store();

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

  FOR r IN
    SELECT
      g.store_id,
      g.weight_g
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
    v_stores := v_stores || r.store_id;
    v_weights := v_weights || r.weight_g;
  END LOOP;

  n := coalesce(array_length(v_stores, 1), 0);
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
    v_fees := v_fees || v_one_fee;
  END LOOP;

  v_fee_total := 0;
  FOR i IN 1..n LOOP
    v_fee_total := v_fee_total + v_fees[i];
  END LOOP;

  RETURN v_fee_total;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_delivery_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_delivery_preview(uuid) TO authenticated;
