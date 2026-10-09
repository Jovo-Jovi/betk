-- T08 CI proof of P11M2 on the local stack only.
-- One result set: name, expected, actual, pass.
-- CASE_COUNT is 18 recorded cases. all_pass checks that count.
--
-- This file issues no DDL and disables no protection. No CREATE, ALTER,
-- DROP, GRANT, REVOKE, DISABLE TRIGGER, DISABLE RULE, or
-- session_replication_role. Fixture writes are DML in this transaction.
-- The closing ROLLBACK undoes them, including order_status_history.
-- It does not DELETE an append-only row. No rule is disabled.
--
-- payment_window_minutes is set to 60 inside this transaction only.
-- description is the label CI TEST VALUE. That write is not a staging
-- value. Agreement version labels in this transaction are CI TEST VALUE.
-- price_band_min_egp and price_band_max_egp are set so an active listing
-- can pass enforce_listing_publish. Courier bands are inserted here and
-- deleted before ROLLBACK. quote_tolerance_multiplier stays the seeded 2.
-- quote_validity_hours stays the seeded 24.
--
-- Sources: PHASE_11_CHECKOUT.md T08, the 2026-10-09 planning-chat note,
-- the flagged rows in the T08 task, and P11M2.sql.
-- Band edges are checkout's: weight_min_g inclusive, weight_max_g
-- exclusive, null weight_max_g is the open upper band.
-- preview_band_at_max is the edge: weight = weight_max_g of the lower
-- band, so the fee is the next band, and checkout's
-- combined_delivery_total equals that preview.
-- R-LOCK is the authenticated FOR UPDATE on cart_items. Checkout calls
-- that succeed roll back with this transaction.

SET TIME ZONE 'UTC';
SET search_path TO betk, public;

BEGIN;

DO $cases$
DECLARE
  v_buyer_empty uuid := 'e1000000-0000-4000-8000-000000000001';
  v_buyer_bad uuid := 'e1000000-0000-4000-8000-000000000002';
  v_buyer_off uuid := 'e1000000-0000-4000-8000-000000000003';
  v_buyer_faults uuid := 'e1000000-0000-4000-8000-000000000004';
  v_buyer_rate uuid := 'e1000000-0000-4000-8000-000000000005';
  v_buyer_two uuid := 'e1000000-0000-4000-8000-000000000006';
  v_buyer_one uuid := 'e1000000-0000-4000-8000-000000000007';
  v_buyer_three uuid := 'e1000000-0000-4000-8000-000000000008';
  v_buyer_below uuid := 'e1000000-0000-4000-8000-000000000009';
  v_buyer_edge uuid := 'e1000000-0000-4000-8000-00000000000a';
  v_buyer_open uuid := 'e1000000-0000-4000-8000-00000000000b';
  v_seller_cairo uuid := 'e1000000-0000-4000-8000-000000000011';
  v_seller_giza uuid := 'e1000000-0000-4000-8000-000000000012';
  v_seller_alex uuid := 'e1000000-0000-4000-8000-000000000013';
  v_seller_off uuid := 'e1000000-0000-4000-8000-000000000014';
  v_store_cairo uuid := 'e2000000-0000-4000-8000-000000000001';
  v_store_giza uuid := 'e2000000-0000-4000-8000-000000000002';
  v_store_alex uuid := 'e2000000-0000-4000-8000-000000000003';
  v_store_off uuid := 'e2000000-0000-4000-8000-000000000004';
  v_list_cairo uuid := 'e3000000-0000-4000-8000-000000000001';
  v_list_giza uuid := 'e3000000-0000-4000-8000-000000000002';
  v_list_alex uuid := 'e3000000-0000-4000-8000-000000000003';
  v_list_off uuid := 'e3000000-0000-4000-8000-000000000004';
  v_list_draft uuid := 'e3000000-0000-4000-8000-000000000005';
  v_list_below uuid := 'e3000000-0000-4000-8000-000000000006';
  v_list_edge uuid := 'e3000000-0000-4000-8000-000000000007';
  v_list_open uuid := 'e3000000-0000-4000-8000-000000000008';
  v_addr_empty uuid := 'e5000000-0000-4000-8000-000000000001';
  v_addr_bad uuid := 'e5000000-0000-4000-8000-000000000002';
  v_addr_off uuid := 'e5000000-0000-4000-8000-000000000003';
  v_addr_faults uuid := 'e5000000-0000-4000-8000-000000000004';
  v_addr_rate uuid := 'e5000000-0000-4000-8000-000000000005';
  v_addr_two uuid := 'e5000000-0000-4000-8000-000000000006';
  v_addr_one uuid := 'e5000000-0000-4000-8000-000000000007';
  v_addr_three uuid := 'e5000000-0000-4000-8000-000000000008';
  v_addr_below uuid := 'e5000000-0000-4000-8000-000000000009';
  v_addr_edge uuid := 'e5000000-0000-4000-8000-00000000000a';
  v_addr_open uuid := 'e5000000-0000-4000-8000-00000000000b';
  v_addr_missing uuid := 'e5000000-0000-4000-8000-0000000000ff';
  v_rate_low uuid := 'e7000000-0000-4000-8000-000000000001';
  v_rate_next uuid := 'e7000000-0000-4000-8000-000000000002';
  v_rate_open uuid := 'e7000000-0000-4000-8000-000000000003';
  v_rate_giza uuid := 'e7000000-0000-4000-8000-000000000004';
  v_rate_alex uuid := 'e7000000-0000-4000-8000-000000000005';
  v_rate_cai_alx uuid := 'e7000000-0000-4000-8000-000000000006';
  v_rate_giz_alx uuid := 'e7000000-0000-4000-8000-000000000007';
  v_arts uuid;
  v_ids uuid[];
  v_rates uuid[];
  v_snap_sql text;
  v_before text;
  v_after text;
  v_master uuid;
  v_fee numeric(10,2);
  v_stored numeric(10,2);
  v_m1 text;
  v_m2 text;
  v_actual text;
  v_shape text;
  v_rows jsonb := '[]'::jsonb;
  v_all boolean;
  v_n integer;
  v_priv boolean;
  v_label text := 'CI TEST VALUE';
  v_fee_low numeric(10,2) := 11.00;
  v_fee_next numeric(10,2) := 22.00;
  v_fee_open numeric(10,2) := 44.00;
  v_fee_giza numeric(10,2) := 27.00;
  v_fee_alex numeric(10,2) := 33.00;
  v_fee_cai_alx numeric(10,2) := 40.00;
  v_fee_giz_alx numeric(10,2) := 50.00;
  v_max_g integer := 500;
BEGIN
  IF to_regprocedure('betk.checkout_delivery_preview(uuid)') IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_PREVIEW_MISSING';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_ids := ARRAY[
    v_list_cairo, v_list_giza, v_list_alex, v_list_off,
    v_list_draft, v_list_below, v_list_edge, v_list_open
  ];
  v_rates := ARRAY[
    v_rate_low, v_rate_next, v_rate_open, v_rate_giza,
    v_rate_alex, v_rate_cai_alx, v_rate_giz_alx
  ];
  v_snap_sql := $snap$
    SELECT
      (SELECT count(*) FROM betk.master_orders)::text || '|' ||
      (SELECT count(*) FROM betk.seller_orders)::text || '|' ||
      (SELECT count(*) FROM betk.order_items)::text || '|' ||
      (SELECT count(*) FROM betk.cart_items)::text || '|' ||
      (SELECT count(*) FROM betk.courier_rates)::text || '|' ||
      coalesce((
        SELECT string_agg(
          l.id::text || ':' || coalesce(l.stock_qty::text, 'null'),
          ',' ORDER BY l.id
        )
        FROM betk.listings AS l
        WHERE l.id = ANY ($1)
      ), 'none')
  $snap$;

  IF (SELECT value FROM betk.admin_settings WHERE key = 'payment_window_minutes')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'agreement_buyer_terms_version')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'agreement_return_policy_version')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'quote_tolerance_multiplier')
       IS DISTINCT FROM '2'
     OR (SELECT value FROM betk.admin_settings WHERE key = 'prep_cap_days')
       IS DISTINCT FROM '3'
     OR (SELECT value FROM betk.admin_settings WHERE key = 'price_band_min_egp')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'price_band_max_egp')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'commission_rate_pct')
       IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_SETTINGS';
  END IF;
  IF EXISTS (SELECT 1 FROM betk.courier_rates) THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_RATES';
  END IF;

  UPDATE betk.admin_settings SET value = '10' WHERE key = 'price_band_min_egp';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_BAND';
  END IF;
  UPDATE betk.admin_settings SET value = '100' WHERE key = 'price_band_max_egp';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_BAND';
  END IF;
  UPDATE betk.admin_settings
  SET value = '60', description = v_label
  WHERE key = 'payment_window_minutes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_WINDOW';
  END IF;
  UPDATE betk.admin_settings SET value = v_label
  WHERE key IN (
    'agreement_buyer_terms_version',
    'agreement_seller_agreement_version',
    'agreement_return_policy_version',
    'agreement_privacy_version'
  );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_AGREEMENT';
  END IF;

  SELECT id INTO v_arts FROM betk.categories WHERE slug = 'arts-crafts';
  IF v_arts IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CATEGORY';
  END IF;

  INSERT INTO betk.users (id, role, status, phone_number) VALUES
    (v_buyer_empty, 'buyer', 'active', '01094220001'),
    (v_buyer_bad, 'buyer', 'active', '01094220002'),
    (v_buyer_off, 'buyer', 'active', '01094220003'),
    (v_buyer_faults, 'buyer', 'active', '01094220004'),
    (v_buyer_rate, 'buyer', 'active', '01094220005'),
    (v_buyer_two, 'buyer', 'active', '01094220006'),
    (v_buyer_one, 'buyer', 'active', '01094220007'),
    (v_buyer_three, 'buyer', 'active', '01094220008'),
    (v_buyer_below, 'buyer', 'active', '01094220009'),
    (v_buyer_edge, 'buyer', 'active', '01094220010'),
    (v_buyer_open, 'buyer', 'active', '01094220011'),
    (v_seller_cairo, 'seller', 'active', '01094220021'),
    (v_seller_giza, 'seller', 'active', '01094220022'),
    (v_seller_alex, 'seller', 'active', '01094220023'),
    (v_seller_off, 'seller', 'active', '01094220024');

  INSERT INTO betk.seller_profiles (id, status) VALUES
    (v_seller_cairo, 'active'),
    (v_seller_giza, 'active'),
    (v_seller_alex, 'active'),
    (v_seller_off, 'active');

  INSERT INTO betk.stores (
    id, seller_id, name_ar, slug, governorate, city, category_primary, status
  ) VALUES
    (v_store_cairo, v_seller_cairo, 'CI Cairo', 'ci-p11m2-cairo', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_giza, v_seller_giza, 'CI Giza', 'ci-p11m2-giza', 'Giza', 'Giza', 'ci', 'active'),
    (v_store_alex, v_seller_alex, 'CI Alex', 'ci-p11m2-alex', 'Alexandria', 'Alexandria', 'ci', 'active'),
    (v_store_off, v_seller_off, 'CI Off', 'ci-p11m2-off', 'Cairo', 'Cairo', 'ci', 'active');

  INSERT INTO betk.store_categories (store_id, category_id) VALUES
    (v_store_cairo, v_arts),
    (v_store_giza, v_arts),
    (v_store_alex, v_arts),
    (v_store_off, v_arts);
  UPDATE betk.store_categories
  SET approved_at = timestamptz '2026-01-15 00:00:00+00'
  WHERE category_id = v_arts
    AND store_id IN (v_store_cairo, v_store_giza, v_store_alex, v_store_off);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CATEGORY_APPROVAL';
  END IF;

  INSERT INTO betk.listings (
    id, store_id, category_id, title_ar, type, price_type, price, stock_qty,
    is_made_to_order, status, weight_g, length_mm, width_mm, height_mm, prep_days
  ) VALUES
    (v_list_cairo, v_store_cairo, v_arts, 'CI cairo', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_giza, v_store_giza, v_arts, 'CI giza', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_alex, v_store_alex, v_arts, 'CI alex', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_off, v_store_off, v_arts, 'CI off', 'product', 'fixed', 40, 5,
     false, 'active', 100, 10, 10, 10, 1),
    (v_list_draft, v_store_cairo, v_arts, 'CI draft', 'product', 'fixed', 40, NULL,
     false, 'draft', NULL, NULL, NULL, NULL, NULL),
    (v_list_below, v_store_cairo, v_arts, 'CI below', 'product', 'fixed', 40, 5,
     false, 'active', v_max_g - 1, 10, 10, 10, 1),
    (v_list_edge, v_store_cairo, v_arts, 'CI edge', 'product', 'fixed', 40, 5,
     false, 'active', v_max_g, 10, 10, 10, 1),
    (v_list_open, v_store_cairo, v_arts, 'CI open', 'product', 'fixed', 40, 5,
     false, 'active', 5000, 10, 10, 10, 1);

  UPDATE betk.stores SET status = 'suspended' WHERE id = v_store_off;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_STORE';
  END IF;

  INSERT INTO betk.addresses (id, buyer_id, governorate, city, street_address) VALUES
    (v_addr_empty, v_buyer_empty, 'Cairo', 'Cairo', '1'),
    (v_addr_bad, v_buyer_bad, 'Cairo', 'Cairo', '1'),
    (v_addr_off, v_buyer_off, 'Cairo', 'Cairo', '1'),
    (v_addr_faults, v_buyer_faults, 'Cairo', 'Cairo', '1'),
    (v_addr_rate, v_buyer_rate, 'Damietta', 'Damietta', '1'),
    (v_addr_two, v_buyer_two, 'Cairo', 'Cairo', '1'),
    (v_addr_one, v_buyer_one, 'Cairo', 'Cairo', '1'),
    (v_addr_three, v_buyer_three, 'Cairo', 'Cairo', '1'),
    (v_addr_below, v_buyer_below, 'Cairo', 'Cairo', '1'),
    (v_addr_edge, v_buyer_edge, 'Cairo', 'Cairo', '1'),
    (v_addr_open, v_buyer_open, 'Cairo', 'Cairo', '1');

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES
    (v_buyer_bad, v_list_draft, 1, 40, false, NULL),
    (v_buyer_off, v_list_off, 1, 40, false, NULL),
    (v_buyer_faults, v_list_draft, 1, 40, false, NULL),
    (v_buyer_faults, v_list_off, 1, 40, false, NULL),
    (v_buyer_rate, v_list_cairo, 1, 40, false, NULL),
    (v_buyer_two, v_list_cairo, 1, 40, false, NULL),
    (v_buyer_two, v_list_giza, 1, 40, false, NULL),
    (v_buyer_one, v_list_cairo, 1, 40, false, NULL),
    (v_buyer_three, v_list_cairo, 1, 40, false, NULL),
    (v_buyer_three, v_list_giza, 1, 40, false, NULL),
    (v_buyer_three, v_list_alex, 1, 40, false, NULL),
    (v_buyer_below, v_list_below, 1, 40, false, NULL),
    (v_buyer_edge, v_list_edge, 1, 40, false, NULL),
    (v_buyer_open, v_list_open, 1, 40, false, NULL);

  INSERT INTO betk.agreement_acceptances (user_id, document, version_label) VALUES
    (v_buyer_faults, 'buyer_terms', v_label),
    (v_buyer_faults, 'return_policy', v_label),
    (v_buyer_one, 'buyer_terms', v_label),
    (v_buyer_one, 'return_policy', v_label),
    (v_buyer_three, 'buyer_terms', v_label),
    (v_buyer_three, 'return_policy', v_label),
    (v_buyer_edge, 'buyer_terms', v_label),
    (v_buyer_edge, 'return_policy', v_label),
    (v_buyer_open, 'buyer_terms', v_label),
    (v_buyer_open, 'return_policy', v_label);

  -- 1. No JWT. Authenticated may execute the function. The body refuses.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_empty;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_unauthenticated',
    'expected', 'BETK_UNAUTHENTICATED',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_UNAUTHENTICATED'
  ));

  -- 2. Address id is not a row. Checked before the cart.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_empty::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_empty, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_missing;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_address_missing',
    'expected', 'BETK_ADDRESS_NOT_FOUND',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_ADDRESS_NOT_FOUND'
  ));

  -- 3. Address exists and belongs to another buyer.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_empty::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_empty, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_one;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_address_not_caller',
    'expected', 'BETK_ADDRESS_NOT_FOUND',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_ADDRESS_NOT_FOUND'
  ));

  -- 4. Own address, empty cart. Address is checked first, so this is next.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_empty::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_empty, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_empty;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_empty_cart',
    'expected', 'BETK_CHECKOUT_EMPTY_CART',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_CHECKOUT_EMPTY_CART'
  ));

  -- 5. Draft listing. The line does not resolve. Store is active.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_bad::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_bad, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_bad;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_line_unresolved',
    'expected', 'BETK_CHECKOUT_LINE_UNRESOLVED',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_CHECKOUT_LINE_UNRESOLVED'
  ));

  -- 6. Active listing on a suspended store.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_off::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_off, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_off;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_store_inactive',
    'expected', 'BETK_CHECKOUT_STORE_INACTIVE',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_CHECKOUT_STORE_INACTIVE'
  ));

  -- 7. One unresolved line and one inactive-store line.
  -- Unresolved is checked before the store helper, so both calls raise it.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_faults::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_faults, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_faults;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_faults;
    v_m2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m2 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || v_m2 || '|'
    || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_two_faults',
    'expected', 'BETK_CHECKOUT_LINE_UNRESOLVED|BETK_CHECKOUT_LINE_UNRESOLVED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_LINE_UNRESOLVED|BETK_CHECKOUT_LINE_UNRESOLVED|unchanged'
  ));

  -- 8. Resolvable cart. No band for Cairo to Damietta.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_rate::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_rate, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_rate;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_rate_missing',
    'expected', 'BETK_CHECKOUT_RATE_MISSING',
    'actual', v_m1,
    'pass', v_m1 = 'BETK_CHECKOUT_RATE_MISSING'
  ));

  -- Bands. Cairo to Cairo: [0, 500) = 11, [500, 1000) = 22, [1000, ) = 44.
  -- weight_max_g 500 is exclusive. A null max is the open upper band.
  INSERT INTO betk.courier_rates (
    id, origin_governorate, destination_governorate, weight_min_g, weight_max_g, fee_egp
  ) VALUES
    (v_rate_low, 'Cairo', 'Cairo', 0, v_max_g, v_fee_low),
    (v_rate_next, 'Cairo', 'Cairo', v_max_g, 1000, v_fee_next),
    (v_rate_open, 'Cairo', 'Cairo', 1000, NULL, v_fee_open),
    (v_rate_giza, 'Giza', 'Cairo', 0, NULL, v_fee_giza),
    (v_rate_alex, 'Alexandria', 'Cairo', 0, NULL, v_fee_alex),
    (v_rate_cai_alx, 'Cairo', 'Alexandria', 0, NULL, v_fee_cai_alx),
    (v_rate_giz_alx, 'Giza', 'Alexandria', 0, NULL, v_fee_giz_alx);

  -- 9. Two stores, two bands, one sum.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_two::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_two, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_two;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  IF v_m1 = 'ok' AND v_fee = v_fee_low + v_fee_giza THEN
    v_actual := trim(to_char(v_fee, '999999990.00'));
  ELSE
    v_actual := v_m1 || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_two_fees_sum',
    'expected', '38.00',
    'actual', v_actual,
    'pass', v_actual = '38.00'
  ));

  -- 10. One numeric result. Not a set. No OUT argument for a per-seller fee.
  -- pg_get_function_result reports numeric. The (10,2) typmod is in the
  -- bound P11M2 source and is not kept on pg_proc.prorettype.
  SELECT pg_get_function_result(p.oid)
      || '|' || p.proretset::text
      || '|' || coalesce(p.proargmodes::text, 'in')
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
    INTO v_shape
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'betk'
    AND p.proname = 'checkout_delivery_preview';
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_no_per_seller_fee',
    'expected', 'numeric|false|in|38.00',
    'actual', coalesce(v_shape, 'none'),
    'pass', v_shape = 'numeric|false|in|38.00'
  ));

  -- 11. Same cart. Destination governorate changes the sum.
  UPDATE betk.addresses
  SET governorate = 'Alexandria'
  WHERE id = v_addr_two
    AND buyer_id = v_buyer_two;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_ADDRESS';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_two::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_two, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_stored := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_stored USING v_addr_two;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_m1 = 'ok'
     AND v_fee = v_fee_low + v_fee_giza
     AND v_stored = v_fee_cai_alx + v_fee_giz_alx
     AND v_stored IS DISTINCT FROM v_fee THEN
    v_actual := trim(to_char(v_fee, '999999990.00'))
      || '|' || trim(to_char(v_stored, '999999990.00'));
  ELSE
    v_actual := v_m1
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || coalesce(trim(to_char(v_stored, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_destination_changes_sum',
    'expected', '38.00|90.00',
    'actual', v_actual,
    'pass', v_actual = '38.00|90.00'
  ));

  -- 12. A successful preview writes none of these.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_one::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_one, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_one;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  IF v_m1 = 'ok' AND v_fee = v_fee_low AND v_before = v_after THEN
    v_actual := 'unchanged';
  ELSE
    v_actual := v_m1 || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_writes_nothing',
    'expected', 'unchanged',
    'actual', v_actual,
    'pass', v_actual = 'unchanged'
  ));

  -- 13. weight = weight_max_g - 1 stays on the lower band.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_below::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_below, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_below;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_m1 = 'ok' AND v_fee = v_fee_low THEN
    v_actual := trim(to_char(v_fee, '999999990.00'));
  ELSE
    v_actual := v_m1 || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_band_below_max',
    'expected', '11.00',
    'actual', v_actual,
    'pass', v_actual = '11.00'
  ));

  -- 14. weight = weight_max_g matches the next band. Checkout stores that sum.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_edge::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_edge, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_edge;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_edge;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_stored := NULL;
  SELECT m.combined_delivery_total
    INTO v_stored
  FROM betk.master_orders AS m
  WHERE m.id = v_master
    AND m.buyer_id = v_buyer_edge;
  IF v_m1 = 'ok' AND v_fee = v_fee_next AND v_stored = v_fee THEN
    v_actual := trim(to_char(v_fee, '999999990.00')) || '|equal';
  ELSE
    v_actual := v_m1
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || coalesce(trim(to_char(v_stored, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_band_at_max',
    'expected', '22.00|equal',
    'actual', v_actual,
    'pass', v_actual = '22.00|equal'
  ));

  -- 15. One store. Preview equals the stored combined total.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_one::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_one, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_one;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_one;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_stored := NULL;
  SELECT m.combined_delivery_total
    INTO v_stored
  FROM betk.master_orders AS m
  WHERE m.id = v_master
    AND m.buyer_id = v_buyer_one;
  IF v_m1 = 'ok' AND v_fee = v_fee_low AND v_stored = v_fee THEN
    v_actual := 'equal|' || trim(to_char(v_fee, '999999990.00'));
  ELSE
    v_actual := v_m1
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || coalesce(trim(to_char(v_stored, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_equals_checkout_one_store',
    'expected', 'equal|11.00',
    'actual', v_actual,
    'pass', v_actual = 'equal|11.00'
  ));

  -- 16. Three stores. One combined total, the sum of the three fees.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_three::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_three, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_three;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_three;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_stored := NULL;
  SELECT m.combined_delivery_total
    INTO v_stored
  FROM betk.master_orders AS m
  WHERE m.id = v_master
    AND m.buyer_id = v_buyer_three;
  IF v_m1 = 'ok'
     AND v_fee = v_fee_low + v_fee_giza + v_fee_alex
     AND v_stored = v_fee THEN
    v_actual := 'equal|' || trim(to_char(v_fee, '999999990.00'));
  ELSE
    v_actual := v_m1
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || coalesce(trim(to_char(v_stored, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_equals_checkout_three_stores',
    'expected', 'equal|71.00',
    'actual', v_actual,
    'pass', v_actual = 'equal|71.00'
  ));

  -- 17. Open upper band. weight_max_g is null. Checkout stores that fee.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_open::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_open, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_open;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_open;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_stored := NULL;
  SELECT m.combined_delivery_total
    INTO v_stored
  FROM betk.master_orders AS m
  WHERE m.id = v_master
    AND m.buyer_id = v_buyer_open;
  IF v_m1 = 'ok' AND v_fee = v_fee_open AND v_stored = v_fee THEN
    v_actual := 'equal|' || trim(to_char(v_fee, '999999990.00'));
  ELSE
    v_actual := v_m1
      || '|' || coalesce(trim(to_char(v_fee, '999999990.00')), 'null')
      || '|' || coalesce(trim(to_char(v_stored, '999999990.00')), 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_equals_checkout_open_upper',
    'expected', 'equal|44.00',
    'actual', v_actual,
    'pass', v_actual = 'equal|44.00'
  ));

  -- 18. anon has no EXECUTE. The call is 42501.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT has_function_privilege(
    'anon',
    'betk.checkout_delivery_preview(uuid)',
    'EXECUTE'
  ) INTO v_priv;
  EXECUTE 'SET ROLE anon';
  BEGIN
    IF current_user IS DISTINCT FROM 'anon' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_fee := NULL;
    EXECUTE 'SELECT betk.checkout_delivery_preview($1)' INTO v_fee USING v_addr_one;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  IF current_user IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'BETK_P11_ROLE';
  END IF;
  v_actual := v_m1 || '|' || CASE WHEN v_priv THEN 't' ELSE 'f' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'preview_anon_denied',
    'expected', '42501|f',
    'actual', v_actual,
    'pass', v_actual = '42501|f'
  ));

  DELETE FROM betk.courier_rates WHERE id = ANY (v_rates);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 7 OR EXISTS (SELECT 1 FROM betk.courier_rates) THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_RATE';
  END IF;

  SELECT coalesce(bool_and((e->>'pass')::boolean), false), count(*)::integer
  INTO v_all, v_n
  FROM jsonb_array_elements(v_rows) AS e;
  v_actual := v_all::text || '|' || v_n::text;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'all_pass',
    'expected', 'true|18',
    'actual', v_actual,
    'pass', v_actual = 'true|18'
  ));

  PERFORM set_config('p11.preview_results', v_rows::text, true);
END;
$cases$;

SELECT r.name, r.expected, r.actual, r.pass
FROM jsonb_to_recordset(current_setting('p11.preview_results')::jsonb)
  AS r(name text, expected text, actual text, pass boolean);

ROLLBACK;
