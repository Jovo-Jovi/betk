-- T04 CI proof of P11M1 on the local stack only.
-- One result set: name, expected, actual, pass.
-- CASE_COUNT is 15 recorded cases. all_pass checks that count.
--
-- This file issues no DDL and disables no protection. No CREATE, ALTER,
-- DROP, GRANT, REVOKE, DISABLE TRIGGER, DISABLE RULE, or
-- session_replication_role. Fixture writes are DML in this transaction.
-- The closing ROLLBACK undoes them, including order_status_history.
-- It does not DELETE an append-only row. No rule is disabled.
--
-- payment_window_minutes is set to 60 inside this transaction only.
-- description is the label CI TEST VALUE. That write is not a staging
-- value. agreement version labels in this transaction are CI TEST VALUE.
-- price_band_min_egp and price_band_max_egp are set so an active listing
-- can pass enforce_listing_publish. The courier band is inserted for the
-- success call and deleted before ROLLBACK. quote_tolerance_multiplier
-- stays the seeded 2. quote_validity_hours stays the seeded 24.
--
-- Sources: PHASE_11_CHECKOUT.md T04, the 2026-10-09 flagged rows,
-- P11M1.sql, and the checkout_row_lock shape in
-- docs/03-database/rehearsal/p10/asserts.sql. R-LOCK is the authenticated
-- FOR UPDATE on cart_items (P10M1 grants UPDATE (updated_at) only).
-- Child display_ref order is store_id ascending, not cart insert order.
-- Buyer A's lines are inserted store c, then store a, then store b.

SET TIME ZONE 'UTC';
SET search_path TO betk, public;

BEGIN;

DO $cases$
DECLARE
  v_buyer_a uuid := 'd1000000-0000-4000-8000-000000000001';
  v_buyer_b uuid := 'd1000000-0000-4000-8000-000000000002';
  v_buyer_c uuid := 'd1000000-0000-4000-8000-000000000003';
  v_buyer_d uuid := 'd1000000-0000-4000-8000-000000000004';
  v_buyer_e uuid := 'd1000000-0000-4000-8000-000000000005';
  v_seller_a uuid := 'd1000000-0000-4000-8000-000000000011';
  v_seller_b uuid := 'd1000000-0000-4000-8000-000000000012';
  v_seller_c uuid := 'd1000000-0000-4000-8000-000000000013';
  v_seller_off uuid := 'd1000000-0000-4000-8000-000000000014';
  v_store_a uuid := 'd2000000-0000-4000-8000-000000000001';
  v_store_b uuid := 'd2000000-0000-4000-8000-000000000002';
  v_store_c uuid := 'd2000000-0000-4000-8000-000000000003';
  v_store_off uuid := 'd2000000-0000-4000-8000-000000000004';
  v_fixed uuid := 'd3000000-0000-4000-8000-000000000001';
  v_custom uuid := 'd3000000-0000-4000-8000-000000000002';
  v_third uuid := 'd3000000-0000-4000-8000-000000000003';
  v_off uuid := 'd3000000-0000-4000-8000-000000000004';
  v_oos uuid := 'd3000000-0000-4000-8000-000000000005';
  v_expired uuid := 'd3000000-0000-4000-8000-000000000006';
  v_plain uuid := 'd3000000-0000-4000-8000-000000000007';
  v_iq_custom uuid := 'd4000000-0000-4000-8000-000000000001';
  v_iq_expired uuid := 'd4000000-0000-4000-8000-000000000002';
  v_addr_a uuid := 'd5000000-0000-4000-8000-000000000001';
  v_addr_b uuid := 'd5000000-0000-4000-8000-000000000002';
  v_addr_c uuid := 'd5000000-0000-4000-8000-000000000003';
  v_addr_d uuid := 'd5000000-0000-4000-8000-000000000004';
  v_addr_e uuid := 'd5000000-0000-4000-8000-000000000005';
  v_rate uuid := 'd7000000-0000-4000-8000-000000000001';
  v_arts uuid;
  v_ids uuid[];
  v_snap_sql text;
  v_before text;
  v_after text;
  v_master uuid;
  v_m1 text;
  v_actual text;
  v_rows jsonb := '[]'::jsonb;
  v_all boolean;
  v_n integer;
  v_cart integer;
  v_label text := 'CI TEST VALUE';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_ids := ARRAY[v_fixed, v_custom, v_third, v_off, v_oos, v_expired, v_plain];
  v_snap_sql := $snap$
    SELECT
      (SELECT count(*) FROM betk.master_orders)::text || '|' ||
      (SELECT count(*) FROM betk.seller_orders)::text || '|' ||
      (SELECT count(*) FROM betk.order_items)::text || '|' ||
      (SELECT count(*) FROM betk.payments)::text || '|' ||
      (SELECT count(*) FROM betk.shipments)::text || '|' ||
      coalesce((
        SELECT sum(l.stock_qty)
        FROM betk.listings AS l
        WHERE l.id = ANY ($1)
      ), 0)::text || '|' ||
      (SELECT count(*) FROM betk.cart_items)::text
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

  SELECT id INTO v_arts FROM betk.categories WHERE slug = 'arts-crafts';
  IF v_arts IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CATEGORY';
  END IF;

  INSERT INTO betk.users (id, role, status, phone_number) VALUES
    (v_buyer_a, 'buyer', 'active', '01094110001'),
    (v_buyer_b, 'buyer', 'active', '01094110002'),
    (v_buyer_c, 'buyer', 'active', '01094110003'),
    (v_buyer_d, 'buyer', 'active', '01094110004'),
    (v_buyer_e, 'buyer', 'active', '01094110005'),
    (v_seller_a, 'seller', 'active', '01094110011'),
    (v_seller_b, 'seller', 'active', '01094110012'),
    (v_seller_c, 'seller', 'active', '01094110013'),
    (v_seller_off, 'seller', 'active', '01094110014');

  INSERT INTO betk.seller_profiles (id, status) VALUES
    (v_seller_a, 'active'),
    (v_seller_b, 'active'),
    (v_seller_c, 'active'),
    (v_seller_off, 'active');

  INSERT INTO betk.stores (
    id, seller_id, name_ar, slug, governorate, city, category_primary, status
  ) VALUES
    (v_store_a, v_seller_a, 'CI A', 'ci-p11-a', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_b, v_seller_b, 'CI B', 'ci-p11-b', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_c, v_seller_c, 'CI C', 'ci-p11-c', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_off, v_seller_off, 'CI Off', 'ci-p11-off', 'Cairo', 'Cairo', 'ci', 'active');

  INSERT INTO betk.store_categories (store_id, category_id) VALUES
    (v_store_a, v_arts),
    (v_store_b, v_arts),
    (v_store_c, v_arts),
    (v_store_off, v_arts);
  UPDATE betk.store_categories
  SET approved_at = timestamptz '2026-01-15 00:00:00+00'
  WHERE category_id = v_arts
    AND store_id IN (v_store_a, v_store_b, v_store_c, v_store_off);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CATEGORY_APPROVAL';
  END IF;

  INSERT INTO betk.listings (
    id, store_id, category_id, title_ar, type, price_type, price, stock_qty,
    is_made_to_order, status, weight_g, length_mm, width_mm, height_mm, prep_days
  ) VALUES
    (v_fixed, v_store_a, v_arts, 'CI fixed', 'product', 'fixed', 50, 5,
     false, 'active', 100, 10, 10, 10, 1),
    (v_custom, v_store_b, v_arts, 'CI custom', 'product', 'fixed', 50, NULL,
     true, 'active', 100, 10, 10, 10, 1),
    (v_third, v_store_c, v_arts, 'CI third', 'product', 'fixed', 30, 5,
     false, 'active', 100, 10, 10, 10, 1),
    (v_off, v_store_off, v_arts, 'CI inactive', 'product', 'fixed', 50, 5,
     false, 'active', 100, 10, 10, 10, 1),
    (v_oos, v_store_a, v_arts, 'CI oos', 'product', 'fixed', 50, 1,
     false, 'active', 100, 10, 10, 10, 1),
    (v_expired, v_store_a, v_arts, 'CI expired', 'product', 'fixed', 50, NULL,
     true, 'active', 100, 10, 10, 10, 1),
    (v_plain, v_store_a, v_arts, 'CI plain', 'product', 'fixed', 50, 5,
     false, 'active', 100, 10, 10, 10, 1);

  INSERT INTO betk.inquiries (
    id, buyer_id, store_id, listing_id, quantity, buyer_first_message
  ) VALUES
    (v_iq_custom, v_buyer_a, v_store_b, v_custom, 1, 'ci'),
    (v_iq_expired, v_buyer_d, v_store_a, v_expired, 1, 'ci');

  UPDATE betk.inquiries
  SET quoted_price = 80,
      quoted_prep_days = 1,
      quoted_at = now(),
      quote_expires_at = now() + interval '48 hours'
  WHERE id = v_iq_custom;
  UPDATE betk.inquiries
  SET quoted_price = 80,
      quoted_prep_days = 1,
      quoted_at = now() - interval '2 hours',
      quote_expires_at = now() - interval '1 hour'
  WHERE id = v_iq_expired;

  INSERT INTO betk.addresses (id, buyer_id, governorate, city, street_address) VALUES
    (v_addr_a, v_buyer_a, 'Cairo', 'Cairo', '1'),
    (v_addr_b, v_buyer_b, 'Cairo', 'Cairo', '1'),
    (v_addr_c, v_buyer_c, 'Cairo', 'Cairo', '1'),
    (v_addr_d, v_buyer_d, 'Cairo', 'Cairo', '1'),
    (v_addr_e, v_buyer_e, 'Cairo', 'Cairo', '1');

  -- Add order is store c, store a, store b. Ascending store_id is a, b, c.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id, created_at
  ) VALUES (
    v_buyer_a, v_third, 1, 30, false, NULL, timestamptz '2026-01-01 00:00:00+00'
  );
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id, created_at
  ) VALUES (
    v_buyer_a, v_fixed, 1, 40, false, NULL, timestamptz '2026-01-02 00:00:00+00'
  );
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id, created_at
  ) VALUES (
    v_buyer_a, v_custom, 1, 70, true, v_iq_custom, timestamptz '2026-01-03 00:00:00+00'
  );
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES
    (v_buyer_b, v_off, 1, 50, false, NULL),
    (v_buyer_c, v_oos, 2, 50, false, NULL),
    (v_buyer_e, v_plain, 1, 50, false, NULL);
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_d, v_expired, 1, 70, true, v_iq_expired
  );

  UPDATE betk.listings SET price = 75 WHERE id = v_fixed;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_PRICE';
  END IF;
  UPDATE betk.stores SET status = 'suspended' WHERE id = v_store_off;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_STORE';
  END IF;

  -- 1. Empty payment window. The existing code is raised before any insert.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_a;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_window_empty',
    'expected', 'BETK_PAYMENT_WINDOW_UNCONFIGURED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_PAYMENT_WINDOW_UNCONFIGURED|unchanged'
  ));

  -- CI TEST VALUE. Local transaction only. 60 parses as the payment window.
  UPDATE betk.admin_settings
  SET value = '60', description = 'CI TEST VALUE'
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

  INSERT INTO betk.agreement_acceptances (user_id, document, version_label) VALUES
    (v_buyer_a, 'buyer_terms', v_label),
    (v_buyer_e, 'return_policy', v_label),
    (v_buyer_b, 'buyer_terms', v_label),
    (v_buyer_b, 'return_policy', v_label),
    (v_buyer_c, 'buyer_terms', v_label),
    (v_buyer_c, 'return_policy', v_label),
    (v_buyer_d, 'buyer_terms', v_label),
    (v_buyer_d, 'return_policy', v_label);

  -- 2. Versions set. buyer_terms acceptance missing. return_policy is present.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_e::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_e, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_e;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_acceptance_missing_terms',
    'expected', 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED|unchanged'
  ));

  -- 3. Versions set. return_policy acceptance missing. buyer_terms is present.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_a;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_acceptance_missing_returns',
    'expected', 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED|unchanged'
  ));

  INSERT INTO betk.agreement_acceptances (user_id, document, version_label)
  VALUES (v_buyer_a, 'return_policy', v_label);

  -- 4. agreement_return_policy_version empty inside this transaction.
  UPDATE betk.admin_settings SET value = '' WHERE key = 'agreement_return_policy_version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_AGREEMENT';
  END IF;
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_a;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_version_unconfigured',
    'expected', 'BETK_CHECKOUT_VERSION_UNCONFIGURED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_VERSION_UNCONFIGURED|unchanged'
  ));
  UPDATE betk.admin_settings SET value = v_label WHERE key = 'agreement_return_policy_version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_AGREEMENT';
  END IF;

  -- 5. Buyer B's inactive store. Writes nothing.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_b;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_store_inactive',
    'expected', 'BETK_CHECKOUT_STORE_INACTIVE|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_STORE_INACTIVE|unchanged'
  ));

  -- 6. No courier band yet.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_a;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_rate_missing',
    'expected', 'BETK_CHECKOUT_RATE_MISSING|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_RATE_MISSING|unchanged'
  ));

  -- 7. Expired custom quote.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_d::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_d, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_d;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_quote_expired',
    'expected', 'BETK_CHECKOUT_QUOTE_EXPIRED|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_QUOTE_EXPIRED|unchanged'
  ));

  -- 8. Tracked stock below the line quantity.
  EXECUTE v_snap_sql INTO v_before USING v_ids;
  PERFORM set_config('request.jwt.claim.sub', v_buyer_c::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_c, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_c;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE v_snap_sql INTO v_after USING v_ids;
  v_actual := v_m1 || '|' || CASE WHEN v_before = v_after THEN 'unchanged' ELSE 'changed' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_out_of_stock',
    'expected', 'BETK_CHECKOUT_OUT_OF_STOCK|unchanged',
    'actual', v_actual,
    'pass', v_actual = 'BETK_CHECKOUT_OUT_OF_STOCK|unchanged'
  ));

  INSERT INTO betk.courier_rates (
    id, origin_governorate, destination_governorate, weight_min_g, weight_max_g, fee_egp
  ) VALUES (
    v_rate, 'Cairo', 'Cairo', 0, 10000, 25
  );

  -- 9. Authenticated success. Buyer B's inactive cart is already present.
  -- seller_agreement and privacy acceptances are not inserted.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer_a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_a;
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT count(*)::integer INTO v_cart
  FROM betk.cart_items
  WHERE buyer_id = v_buyer_a;
  IF v_m1 = 'ok' AND v_master IS NOT NULL AND v_cart = 0 THEN
    v_actual := 'ok';
  ELSE
    v_actual := v_m1 || '|' || coalesce(v_cart::text, 'null');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_row_lock',
    'expected', 'ok',
    'actual', v_actual,
    'pass', v_actual = 'ok'
  ));

  SELECT
    count(*) FILTER (WHERE document = 'buyer_terms')::text || '|' ||
    count(*) FILTER (WHERE document = 'return_policy')::text || '|' ||
    count(*) FILTER (WHERE document IN ('seller_agreement', 'privacy'))::text
  INTO v_actual
  FROM betk.agreement_acceptances
  WHERE user_id = v_buyer_a
    AND version_label = v_label;
  IF v_m1 = 'ok' AND v_actual = '1|1|0' THEN
    v_actual := 'ok|1|1|0';
  ELSE
    v_actual := v_m1 || '|' || coalesce(v_actual, 'none');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_acceptances_pass',
    'expected', 'ok|1|1|0',
    'actual', v_actual,
    'pass', v_actual = 'ok|1|1|0'
  ));

  SELECT CASE
    WHEN oi.unit_price = 40 AND l.price = 75 THEN '40|75'
    ELSE coalesce(oi.unit_price::text, 'null') || '|' || coalesce(l.price::text, 'null')
  END
  INTO v_actual
  FROM betk.order_items AS oi
  JOIN betk.listings AS l ON l.id = oi.listing_id
  WHERE oi.listing_id = v_fixed;
  IF NOT FOUND THEN
    v_actual := 'none';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_fixed_unit_price',
    'expected', '40|75',
    'actual', v_actual,
    'pass', v_actual = '40|75'
  ));

  SELECT CASE
    WHEN oi.unit_price = 70 AND q.quoted_price = 80 AND l.price = 50 THEN '70|80|50'
    ELSE coalesce(oi.unit_price::text, 'null') || '|'
      || coalesce(q.quoted_price::text, 'null') || '|'
      || coalesce(l.price::text, 'null')
  END
  INTO v_actual
  FROM betk.order_items AS oi
  JOIN betk.listings AS l ON l.id = oi.listing_id
  JOIN betk.inquiries AS q ON q.id = oi.inquiry_id
  WHERE oi.listing_id = v_custom;
  IF NOT FOUND THEN
    v_actual := 'none';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_custom_unit_price',
    'expected', '70|80|50',
    'actual', v_actual,
    'pass', v_actual = '70|80|50'
  ));

  SELECT coalesce(string_agg(
    substr(so.display_ref, length(m.betk_ref) + 2),
    '|' ORDER BY so.store_id
  ), 'none')
  INTO v_actual
  FROM betk.seller_orders AS so
  JOIN betk.master_orders AS m ON m.id = so.master_order_id
  WHERE so.buyer_id = v_buyer_a;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_display_ref_order',
    'expected', '1|2|3',
    'actual', v_actual,
    'pass', v_actual = '1|2|3'
  ));

  SELECT CASE
    WHEN count(*) = 3
     AND count(DISTINCT m.id) = 1
     AND bool_and(m.betk_ref ~ '^BETK-[0-9]{8}-[0-9A-F]{4}$')
     AND bool_and(so.betk_ref IS NULL)
     AND bool_and(so.display_ref ~ ('^' || m.betk_ref || '-[0-9]+$'))
    THEN 'match'
    ELSE coalesce(max(m.betk_ref), 'none')
      || '|' || coalesce(string_agg(coalesce(so.display_ref, 'null'), ',' ORDER BY so.store_id), 'none')
      || '|' || coalesce(string_agg(coalesce(so.betk_ref, 'null'), ',' ORDER BY so.store_id), 'none')
  END
  INTO v_actual
  FROM betk.seller_orders AS so
  JOIN betk.master_orders AS m ON m.id = so.master_order_id
  WHERE so.buyer_id = v_buyer_a;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_betk_ref_shape',
    'expected', 'match',
    'actual', v_actual,
    'pass', v_actual = 'match'
  ));

  SELECT count(*)::text INTO v_actual
  FROM betk.cart_items
  WHERE buyer_id = v_buyer_b;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_caller_cart',
    'expected', '1',
    'actual', v_actual,
    'pass', v_actual = '1'
  ));

  DELETE FROM betk.courier_rates WHERE id = v_rate;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_RATE';
  END IF;

  SELECT coalesce(bool_and((e->>'pass')::boolean), false), count(*)::integer
  INTO v_all, v_n
  FROM jsonb_array_elements(v_rows) AS e;
  v_actual := v_all::text || '|' || v_n::text;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'all_pass',
    'expected', 'true|15',
    'actual', v_actual,
    'pass', v_actual = 'true|15'
  ));

  PERFORM set_config('p11.results', v_rows::text, true);
END;
$cases$;

SELECT r.name, r.expected, r.actual, r.pass
FROM jsonb_to_recordset(current_setting('p11.results')::jsonb)
  AS r(name text, expected text, actual text, pass boolean);

ROLLBACK;
