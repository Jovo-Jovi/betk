-- T11 CI proof of P11M3 on the local stack only.
-- One result set: name, expected, actual, pass.
-- CASE_COUNT is 17 recorded cases. all_pass checks that count.
--
-- This file issues no DDL and disables no protection. No CREATE, ALTER,
-- DROP, GRANT, REVOKE, DISABLE TRIGGER, DISABLE RULE, or
-- session_replication_role. Fixture writes are DML in this transaction.
-- The closing ROLLBACK undoes them, including order_status_history.
-- It does not DELETE an append-only row. No rule is disabled.
--
-- The sweeper is called as the function owner (current_user must equal
-- proowner). auth.uid() is null for that call. There is no pg_sleep and
-- no read of cron.job_run_details. The cron row only checks that the
-- job exists once at '* * * * *'.
--
-- payment_window_minutes is set to 60 inside this transaction only.
-- description is the label CI TEST VALUE. That write is not a staging
-- value. Agreement version labels in this transaction are CI TEST VALUE.
-- price_band_min_egp and price_band_max_egp are set so an active listing
-- can pass enforce_listing_publish. The courier band is inserted here
-- and deleted before ROLLBACK. quote_tolerance_multiplier stays the
-- seeded 2. quote_validity_hours stays the seeded 24.
--
-- Sources: PHASE_11_CHECKOUT.md T11, the 2026-10-10 planning-chat notes,
-- the flagged rows, P11M3.sql, and restore_stock_on_cancel in
-- 20261003082041_v2_08_functions.sql. A checkout fixture keeps its
-- creation history row (notes order created) and gains one sweep row.
-- sweep_warning_isolates forces one restore to fail with the existing
-- cart unique index. No DDL.
--
-- Rows:
-- sweep_anon_denied 42501|f
-- sweep_authenticated_denied 42501|f
-- sweep_cron 1|* * * * *|call
-- sweep_exception_block per_master_exception
-- sweep_writes_no_stock_directly no_listing_update|no_cart_insert|restore_stock_on_cancel
-- sweep_expired swept
-- sweep_proof_kept kept
-- sweep_future_kept kept
-- sweep_null_deadline kept
-- sweep_escalation unchanged
-- sweep_history sweep:3|created:3
-- sweep_dropped_prompt in_window|quote_expired|no_cart
-- sweep_three_stores 3|3|1
-- sweep_mixed_children confirmed|0
-- sweep_warning_isolates pending|cancelled
-- sweep_second_run unchanged
-- sweep_limit 100|1

SET TIME ZONE 'UTC';
SET search_path TO betk, public;

BEGIN;

DO $cases$
DECLARE
  v_buyer_main uuid := 'f1000000-0000-4000-8000-000000000001';
  v_buyer_hold uuid := 'f1000000-0000-4000-8000-000000000002';
  v_buyer_iso uuid := 'f1000000-0000-4000-8000-000000000003';
  v_buyer_mixed uuid := 'f1000000-0000-4000-8000-000000000004';
  v_buyer_limit uuid := 'f1000000-0000-4000-8000-000000000005';
  v_seller_a uuid := 'f1000000-0000-4000-8000-000000000011';
  v_seller_b uuid := 'f1000000-0000-4000-8000-000000000012';
  v_seller_c uuid := 'f1000000-0000-4000-8000-000000000013';
  v_store_a uuid := 'f2000000-0000-4000-8000-000000000001';
  v_store_b uuid := 'f2000000-0000-4000-8000-000000000002';
  v_store_c uuid := 'f2000000-0000-4000-8000-000000000003';
  v_list_fixed uuid := 'f3000000-0000-4000-8000-000000000001';
  v_list_live uuid := 'f3000000-0000-4000-8000-000000000002';
  v_list_drop uuid := 'f3000000-0000-4000-8000-000000000003';
  v_list_proof uuid := 'f3000000-0000-4000-8000-000000000004';
  v_list_future uuid := 'f3000000-0000-4000-8000-000000000005';
  v_list_null uuid := 'f3000000-0000-4000-8000-000000000006';
  v_list_fail uuid := 'f3000000-0000-4000-8000-000000000007';
  v_list_ok uuid := 'f3000000-0000-4000-8000-000000000008';
  v_iq_live uuid := 'f4000000-0000-4000-8000-000000000001';
  v_iq_drop uuid := 'f4000000-0000-4000-8000-000000000002';
  v_addr_main uuid := 'f5000000-0000-4000-8000-000000000001';
  v_addr_hold uuid := 'f5000000-0000-4000-8000-000000000002';
  v_addr_iso uuid := 'f5000000-0000-4000-8000-000000000003';
  v_rate uuid := 'f7000000-0000-4000-8000-000000000001';
  v_master_mixed uuid := 'f6000000-0000-4000-8000-000000000001';
  v_child_pending uuid := 'f6000000-0000-4000-8000-000000000011';
  v_child_kept uuid := 'f6000000-0000-4000-8000-000000000012';
  v_arts uuid;
  v_master uuid;
  v_master_main uuid;
  v_master_proof uuid;
  v_master_future uuid;
  v_master_null uuid;
  v_master_fail uuid;
  v_master_ok uuid;
  v_rows jsonb := '[]'::jsonb;
  v_all boolean;
  v_n integer;
  v_priv boolean;
  v_label text := 'CI TEST VALUE';
  v_def text;
  v_owner text;
  v_m1 text;
  v_actual text;
  v_sched text;
  v_cmd text;
  v_fp text;
  v_fp2 text;
  v_esc_at timestamptz;
  v_esc_reason text;
  v_esc_note text;
  v_stock integer;
  v_fail_stock integer;
  v_candidates integer;
BEGIN
  IF to_regprocedure('betk.sweep_expired_payment_windows()') IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_SWEEP_MISSING';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  IF (SELECT value FROM betk.admin_settings WHERE key = 'payment_window_minutes')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'agreement_buyer_terms_version')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'agreement_return_policy_version')
       IS DISTINCT FROM ''
     OR (SELECT value FROM betk.admin_settings WHERE key = 'quote_tolerance_multiplier')
       IS DISTINCT FROM '2'
     OR (SELECT value FROM betk.admin_settings WHERE key = 'quote_validity_hours')
       IS DISTINCT FROM '24'
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
    (v_buyer_main, 'buyer', 'active', '01094330001'),
    (v_buyer_hold, 'buyer', 'active', '01094330002'),
    (v_buyer_iso, 'buyer', 'active', '01094330003'),
    (v_buyer_mixed, 'buyer', 'active', '01094330004'),
    (v_buyer_limit, 'buyer', 'active', '01094330005'),
    (v_seller_a, 'seller', 'active', '01094330011'),
    (v_seller_b, 'seller', 'active', '01094330012'),
    (v_seller_c, 'seller', 'active', '01094330013');

  INSERT INTO betk.seller_profiles (id, status) VALUES
    (v_seller_a, 'active'),
    (v_seller_b, 'active'),
    (v_seller_c, 'active');

  INSERT INTO betk.stores (
    id, seller_id, name_ar, slug, governorate, city, category_primary, status
  ) VALUES
    (v_store_a, v_seller_a, 'CI A', 'ci-p11m3-a', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_b, v_seller_b, 'CI B', 'ci-p11m3-b', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_store_c, v_seller_c, 'CI C', 'ci-p11m3-c', 'Cairo', 'Cairo', 'ci', 'active');

  INSERT INTO betk.store_categories (store_id, category_id) VALUES
    (v_store_a, v_arts),
    (v_store_b, v_arts),
    (v_store_c, v_arts);
  UPDATE betk.store_categories
  SET approved_at = timestamptz '2026-01-15 00:00:00+00'
  WHERE category_id = v_arts
    AND store_id IN (v_store_a, v_store_b, v_store_c);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CATEGORY_APPROVAL';
  END IF;

  INSERT INTO betk.listings (
    id, store_id, category_id, title_ar, type, price_type, price, stock_qty,
    is_made_to_order, status, weight_g, length_mm, width_mm, height_mm, prep_days
  ) VALUES
    (v_list_fixed, v_store_a, v_arts, 'CI fixed', 'product', 'fixed', 50, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_live, v_store_b, v_arts, 'CI live', 'product', 'fixed', 50, NULL,
     true, 'active', 200, 10, 10, 10, 1),
    (v_list_drop, v_store_c, v_arts, 'CI drop', 'product', 'fixed', 50, NULL,
     true, 'active', 200, 10, 10, 10, 1),
    (v_list_proof, v_store_a, v_arts, 'CI proof', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_future, v_store_a, v_arts, 'CI future', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_null, v_store_a, v_arts, 'CI null', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_fail, v_store_a, v_arts, 'CI fail', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1),
    (v_list_ok, v_store_a, v_arts, 'CI ok', 'product', 'fixed', 40, 5,
     false, 'active', 200, 10, 10, 10, 1);

  UPDATE betk.listings SET price = 75 WHERE id = v_list_fixed;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_PRICE';
  END IF;

  INSERT INTO betk.inquiries (
    id, buyer_id, store_id, listing_id, quantity, buyer_first_message,
    quoted_price, quoted_prep_days, quoted_at, quote_expires_at
  ) VALUES
    (v_iq_live, v_buyer_main, v_store_b, v_list_live, 1, 'ci',
     80, 1, now(), now() + interval '48 hours'),
    (v_iq_drop, v_buyer_main, v_store_c, v_list_drop, 1, 'ci',
     80, 1, now(), now() + interval '48 hours');

  INSERT INTO betk.addresses (id, buyer_id, governorate, city, street_address) VALUES
    (v_addr_main, v_buyer_main, 'Cairo', 'Cairo', '1'),
    (v_addr_hold, v_buyer_hold, 'Cairo', 'Cairo', '1'),
    (v_addr_iso, v_buyer_iso, 'Cairo', 'Cairo', '1');

  INSERT INTO betk.agreement_acceptances (user_id, document, version_label) VALUES
    (v_buyer_main, 'buyer_terms', v_label),
    (v_buyer_main, 'return_policy', v_label),
    (v_buyer_hold, 'buyer_terms', v_label),
    (v_buyer_hold, 'return_policy', v_label),
    (v_buyer_iso, 'buyer_terms', v_label),
    (v_buyer_iso, 'return_policy', v_label);

  INSERT INTO betk.courier_rates (
    id, origin_governorate, destination_governorate, weight_min_g, weight_max_g, fee_egp
  ) VALUES (
    v_rate, 'Cairo', 'Cairo', 0, NULL, 11
  );

  SELECT pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner)
    INTO v_def, v_owner
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'betk'
    AND p.proname = 'sweep_expired_payment_windows'
    AND p.pronargs = 0;
  IF v_def IS NULL OR v_owner IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_SWEEP_DEF';
  END IF;

  -- 1. anon cannot execute.
  SELECT has_function_privilege(
    'anon', 'betk.sweep_expired_payment_windows()', 'EXECUTE'
  ) INTO v_priv;
  EXECUTE 'SET ROLE anon';
  BEGIN
    IF current_user IS DISTINCT FROM 'anon' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    PERFORM betk.sweep_expired_payment_windows();
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  v_actual := v_m1 || '|' || CASE WHEN v_priv THEN 't' ELSE 'f' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_anon_denied',
    'expected', '42501|f',
    'actual', v_actual,
    'pass', v_actual = '42501|f'
  ));

  -- 2. authenticated cannot execute.
  SELECT has_function_privilege(
    'authenticated', 'betk.sweep_expired_payment_windows()', 'EXECUTE'
  ) INTO v_priv;
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    PERFORM betk.sweep_expired_payment_windows();
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  v_actual := v_m1 || '|' || CASE WHEN v_priv THEN 't' ELSE 'f' END;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_authenticated_denied',
    'expected', '42501|f',
    'actual', v_actual,
    'pass', v_actual = '42501|f'
  ));

  -- 3. The job exists once. Schedule is every minute. Do not wait for it.
  SELECT count(*)::integer, min(j.schedule), min(btrim(j.command))
    INTO v_n, v_sched, v_cmd
  FROM cron.job AS j
  WHERE j.jobname = 'sweep-expired-payment-windows';
  IF v_n = 1 AND v_sched = '* * * * *'
     AND v_cmd = 'SELECT betk.sweep_expired_payment_windows()' THEN
    v_actual := '1|* * * * *|call';
  ELSE
    v_actual := coalesce(v_n::text, '0') || '|'
      || coalesce(v_sched, 'none') || '|'
      || coalesce(v_cmd, 'none');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_cron',
    'expected', '1|* * * * *|call',
    'actual', v_actual,
    'pass', v_actual = '1|* * * * *|call'
  ));

  -- 4. One EXCEPTION block inside the per-master loop.
  IF strpos(v_def, 'EXCEPTION') > strpos(v_def, 'FOR v_master_id')
     AND strpos(v_def, 'EXCEPTION') > 0
     AND (length(v_def) - length(replace(v_def, 'EXCEPTION', '')))
         = length('EXCEPTION')
     AND v_def LIKE '%WHEN OTHERS%'
     AND v_def LIKE '%RAISE WARNING%'
     AND strpos(v_def, 'SQLSTATE') > strpos(v_def, 'EXCEPTION')
     AND strpos(v_def, 'SQLERRM') > strpos(v_def, 'EXCEPTION')
     AND strpos(v_def, 'v_master_id') > 0 THEN
    v_actual := 'per_master_exception';
  ELSE
    v_actual := 'missing';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_exception_block',
    'expected', 'per_master_exception',
    'actual', v_actual,
    'pass', v_actual = 'per_master_exception'
  ));

  -- 5. The body does not write listings or cart_items.
  -- Stock and cart changes come from trg_restore_stock_on_cancel.
  IF position('listings' in lower(v_def)) = 0
     AND position('cart_items' in lower(v_def)) = 0
     AND position('update' in lower(v_def)) > 0
     AND EXISTS (
       SELECT 1
       FROM pg_trigger AS t
       JOIN pg_proc AS p ON p.oid = t.tgfoid
       JOIN pg_class AS c ON c.oid = t.tgrelid
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'betk'
         AND c.relname = 'seller_orders'
         AND t.tgname = 'trg_restore_stock_on_cancel'
         AND p.proname = 'restore_stock_on_cancel'
         AND NOT t.tgisinternal
         AND t.tgenabled = 'O'
     ) THEN
    v_actual := 'no_listing_update|no_cart_insert|restore_stock_on_cancel';
  ELSE
    v_actual := 'present';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_writes_no_stock_directly',
    'expected', 'no_listing_update|no_cart_insert|restore_stock_on_cancel',
    'actual', v_actual,
    'pass', v_actual = 'no_listing_update|no_cart_insert|restore_stock_on_cancel'
  ));

  -- Main checkout: fixed snapshot, live custom, custom that is expired later.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES
    (v_buyer_main, v_list_fixed, 1, 40, false, NULL),
    (v_buyer_main, v_list_live, 1, 70, true, v_iq_live),
    (v_buyer_main, v_list_drop, 1, 70, true, v_iq_drop);

  PERFORM set_config('request.jwt.claim.sub', v_buyer_main::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_main, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    IF current_user IS DISTINCT FROM 'authenticated' THEN
      RAISE EXCEPTION 'BETK_P11_ROLE';
    END IF;
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_main;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT main %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_master_main := v_master;
  IF v_master_main IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT main';
  END IF;

  -- Hold buyer: proof, then a future deadline, then a null deadline.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_hold, v_list_proof, 1, 40, false, NULL
  );
  PERFORM set_config('request.jwt.claim.sub', v_buyer_hold::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_hold, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_hold;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT proof %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  v_master_proof := v_master;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_hold, v_list_future, 1, 40, false, NULL
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_hold;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT future %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  v_master_future := v_master;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_hold, v_list_null, 1, 40, false, NULL
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_hold;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT null %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_master_null := v_master;
  IF v_master_proof IS NULL OR v_master_future IS NULL OR v_master_null IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT hold';
  END IF;

  -- Isolation pair. The collision cart is inserted after both checkouts,
  -- because checkout deletes the buyer's cart.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_iso, v_list_fail, 1, 40, false, NULL
  );
  PERFORM set_config('request.jwt.claim.sub', v_buyer_iso::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_iso, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_iso;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT fail %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  v_master_fail := v_master;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_iso, v_list_ok, 1, 40, false, NULL
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    v_master := NULL;
    EXECUTE 'SELECT betk.checkout_from_cart($1)' INTO v_master USING v_addr_iso;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT ok %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_master_ok := v_master;
  IF v_master_fail IS NULL OR v_master_ok IS NULL THEN
    RAISE EXCEPTION 'BETK_P11_CHECKOUT iso';
  END IF;

  IF (
    SELECT count(*)
    FROM betk.seller_orders AS s
    WHERE s.master_order_id = v_master_main
      AND s.status = 'pending'::betk.order_status
  ) <> 3 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CHILDREN';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM betk.order_items AS i
    WHERE i.listing_id = v_list_fixed
      AND i.unit_price = 40
      AND i.quantity = 1
      AND i.inquiry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_SNAPSHOT';
  END IF;
  IF (
    SELECT count(*)
    FROM betk.order_status_history AS h
    JOIN betk.seller_orders AS s ON s.id = h.order_id
    WHERE s.master_order_id = v_master_main
      AND h.from_status IS NULL
      AND h.to_status = 'pending'::betk.order_status
      AND h.changed_by = v_buyer_main
      AND h.changed_by_type = 'buyer'::betk.cancelled_by_type
      AND h.notes = 'order created'
  ) <> 3 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CREATED_HISTORY';
  END IF;
  SELECT l.stock_qty INTO v_stock
  FROM betk.listings AS l
  WHERE l.id = v_list_fixed;
  IF v_stock IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_STOCK %', v_stock;
  END IF;
  SELECT l.stock_qty INTO v_fail_stock
  FROM betk.listings AS l
  WHERE l.id = v_list_fail;
  IF v_fail_stock IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_FAIL_STOCK %', v_fail_stock;
  END IF;

  -- Proof while the deadline is still in the future, then move it back.
  PERFORM set_config('request.jwt.claim.sub', v_buyer_hold::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_buyer_hold, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    UPDATE betk.master_orders
    SET proof_path = 'ci/proof.png',
        transfer_reference = 'CI-REF'
    WHERE id = v_master_proof
      AND buyer_id = v_buyer_hold;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'BETK_P11_FIXTURE_PROOF_COUNT %', v_n;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_PROOF %', SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('search_path', 'betk, public', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF current_user IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'BETK_P11_ROLE % %', current_user, v_owner;
  END IF;

  UPDATE betk.master_orders
  SET payment_deadline = now() - interval '1 minute'
  WHERE id = v_master_proof;
  UPDATE betk.master_orders
  SET payment_deadline = NULL
  WHERE id = v_master_null;
  UPDATE betk.master_orders
  SET payment_deadline = now() - interval '10 hours'
  WHERE id = v_master_fail;
  UPDATE betk.master_orders
  SET payment_deadline = now() - interval '9 hours'
  WHERE id = v_master_ok;
  UPDATE betk.master_orders
  SET payment_deadline = now() - interval '8 hours'
  WHERE id = v_master_main;
  UPDATE betk.inquiries
  SET quote_expires_at = now() - interval '1 hour'
  WHERE id = v_iq_drop;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_DROP_QUOTE';
  END IF;

  -- Fixed-line restore will hit uq_cart_items_listing. No DDL.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer_iso, v_list_fail, 1, 40, false, NULL
  );

  INSERT INTO betk.master_orders (
    id, buyer_id, betk_ref, combined_delivery_total, proof_path, payment_deadline
  ) VALUES (
    v_master_mixed, v_buyer_mixed, 'CI-SWEEP-MIXED', 0, NULL, now() - interval '7 hours'
  );
  INSERT INTO betk.seller_orders (
    id, buyer_id, store_id, delivery_method, delivery_fee, subtotal, total_amount,
    status, master_order_id, escalated_at, escalation_reason, escalation_note
  ) VALUES (
    v_child_pending, v_buyer_mixed, v_store_a, 'delivery'::betk.delivery_preference,
    0, 10, 10, 'pending'::betk.order_status, v_master_mixed,
    timestamptz '2026-01-01 00:00:00+00',
    'out_of_stock'::betk.escalation_reason,
    v_label
  );
  INSERT INTO betk.seller_orders (
    id, buyer_id, store_id, delivery_method, delivery_fee, subtotal, total_amount,
    status, master_order_id
  ) VALUES (
    v_child_kept, v_buyer_mixed, v_store_b, 'delivery'::betk.delivery_preference,
    0, 10, 10, 'confirmed'::betk.order_status, v_master_mixed
  );

  SELECT s.escalated_at, s.escalation_reason::text, s.escalation_note
    INTO v_esc_at, v_esc_reason, v_esc_note
  FROM betk.seller_orders AS s
  WHERE s.id = v_child_pending;
  IF v_esc_at IS DISTINCT FROM timestamptz '2026-01-01 00:00:00+00'
     OR v_esc_reason IS DISTINCT FROM 'out_of_stock'
     OR v_esc_note IS DISTINCT FROM v_label THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_ESCALATION';
  END IF;
  IF (
    SELECT m1.payment_deadline >= m2.payment_deadline
    FROM betk.master_orders AS m1
    CROSS JOIN betk.master_orders AS m2
    WHERE m1.id = v_master_fail
      AND m2.id = v_master_ok
  ) THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_ORDER';
  END IF;

  IF current_user IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'BETK_P11_SWEEP_OWNER % %', current_user, v_owner;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'BETK_P11_SWEEP_JWT';
  END IF;
  PERFORM betk.sweep_expired_payment_windows();

  -- 6. Expired null-proof master: cancel, stock, cart, one notification.
  IF (
       SELECT count(*)
       FROM betk.seller_orders AS s
       WHERE s.master_order_id = v_master_main
         AND s.status = 'cancelled'::betk.order_status
         AND s.cancelled_by = 'system'::betk.cancelled_by_type
     ) = 3
     AND EXISTS (
       SELECT 1
       FROM betk.listings AS l
       WHERE l.id = v_list_fixed
         AND l.stock_qty = 5
         AND l.price = 75
         AND l.status = 'active'::betk.listing_status
     )
     AND EXISTS (
       SELECT 1
       FROM betk.cart_items AS c
       WHERE c.buyer_id = v_buyer_main
         AND c.listing_id = v_list_fixed
         AND c.quantity = 1
         AND c.unit_price = 40
         AND c.is_custom = false
         AND c.inquiry_id IS NULL
     )
     AND EXISTS (
       SELECT 1
       FROM betk.cart_items AS c
       JOIN betk.inquiries AS q ON q.id = c.inquiry_id
       WHERE c.buyer_id = v_buyer_main
         AND c.listing_id = v_list_live
         AND c.quantity = 1
         AND c.unit_price = 70
         AND c.is_custom = true
         AND c.inquiry_id = v_iq_live
         AND q.quote_expires_at > now()
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.cart_items AS c
       WHERE c.inquiry_id = v_iq_drop
          OR (c.buyer_id = v_buyer_main AND c.listing_id = v_list_drop)
     )
     AND (
       SELECT count(*)
       FROM betk.notifications AS n
       JOIN betk.master_orders AS m ON m.id = v_master_main
       WHERE n.user_id = v_buyer_main
         AND n.type = 'payment_window_expired'
         AND n.channel::text = 'sms'
         AND n.data->>'master_order_id' = v_master_main::text
         AND n.body = 'BETK Alert: Order #' || m.betk_ref || ' payment window expired.'
     ) = 1 THEN
    v_actual := 'swept';
  ELSE
    v_actual := 'miss';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_expired',
    'expected', 'swept',
    'actual', v_actual,
    'pass', v_actual = 'swept'
  ));

  -- 7. A proof keeps the children pending.
  IF EXISTS (
       SELECT 1
       FROM betk.master_orders AS m
       JOIN betk.seller_orders AS s ON s.master_order_id = m.id
       WHERE m.id = v_master_proof
         AND m.proof_path IS NOT NULL
         AND m.payment_deadline < now()
         AND s.status = 'pending'::betk.order_status
         AND s.cancelled_by IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.order_status_history AS h
       JOIN betk.seller_orders AS s ON s.id = h.order_id
       WHERE s.master_order_id = v_master_proof
         AND h.notes = 'payment_window_expired'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.notifications AS n
       WHERE n.data->>'master_order_id' = v_master_proof::text
     ) THEN
    v_actual := 'kept';
  ELSE
    v_actual := 'swept';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_proof_kept',
    'expected', 'kept',
    'actual', v_actual,
    'pass', v_actual = 'kept'
  ));

  -- 8. A future deadline is not swept.
  IF EXISTS (
       SELECT 1
       FROM betk.master_orders AS m
       JOIN betk.seller_orders AS s ON s.master_order_id = m.id
       WHERE m.id = v_master_future
         AND m.proof_path IS NULL
         AND m.payment_deadline > now()
         AND s.status = 'pending'::betk.order_status
         AND s.cancelled_by IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.notifications AS n
       WHERE n.data->>'master_order_id' = v_master_future::text
     ) THEN
    v_actual := 'kept';
  ELSE
    v_actual := 'swept';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_future_kept',
    'expected', 'kept',
    'actual', v_actual,
    'pass', v_actual = 'kept'
  ));

  -- 9. A null deadline is not swept.
  IF EXISTS (
       SELECT 1
       FROM betk.master_orders AS m
       JOIN betk.seller_orders AS s ON s.master_order_id = m.id
       WHERE m.id = v_master_null
         AND m.payment_deadline IS NULL
         AND m.proof_path IS NULL
         AND s.status = 'pending'::betk.order_status
         AND s.cancelled_by IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.notifications AS n
       WHERE n.data->>'master_order_id' = v_master_null::text
     ) THEN
    v_actual := 'kept';
  ELSE
    v_actual := 'swept';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_null_deadline',
    'expected', 'kept',
    'actual', v_actual,
    'pass', v_actual = 'kept'
  ));

  -- 10. Escalation columns are not written by the cancel.
  IF EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       WHERE s.id = v_child_pending
         AND s.status = 'cancelled'::betk.order_status
         AND s.cancelled_by = 'system'::betk.cancelled_by_type
         AND s.escalated_at IS NOT DISTINCT FROM v_esc_at
         AND s.escalation_reason::text IS NOT DISTINCT FROM v_esc_reason
         AND s.escalation_note IS NOT DISTINCT FROM v_esc_note
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       WHERE s.master_order_id = v_master_main
         AND (
           s.escalated_at IS NOT NULL
           OR s.escalation_reason IS NOT NULL
           OR s.escalation_note IS NOT NULL
         )
     ) THEN
    v_actual := 'unchanged';
  ELSE
    v_actual := 'changed';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_escalation',
    'expected', 'unchanged',
    'actual', v_actual,
    'pass', v_actual = 'unchanged'
  ));

  -- 11. One sweep history row per child, and the checkout creation row.
  SELECT count(*)::integer INTO v_n
  FROM betk.seller_orders AS s
  WHERE s.master_order_id = v_master_main
    AND (
      SELECT count(*)
      FROM betk.order_status_history AS h
      WHERE h.order_id = s.id
        AND h.from_status = 'pending'::betk.order_status
        AND h.to_status = 'cancelled'::betk.order_status
        AND h.changed_by IS NULL
        AND h.changed_by_type = 'system'::betk.cancelled_by_type
        AND h.notes = 'payment_window_expired'
    ) = 1
    AND (
      SELECT count(*)
      FROM betk.order_status_history AS h
      WHERE h.order_id = s.id
        AND h.from_status IS NULL
        AND h.to_status = 'pending'::betk.order_status
        AND h.changed_by = v_buyer_main
        AND h.changed_by_type = 'buyer'::betk.cancelled_by_type
        AND h.notes = 'order created'
    ) = 1
    AND (
      SELECT count(*)
      FROM betk.order_status_history AS h
      WHERE h.order_id = s.id
    ) = 2;
  IF v_n = 3 THEN
    v_actual := 'sweep:3|created:3';
  ELSE
    v_actual := 'sweep:' || coalesce(v_n::text, '0');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_history',
    'expected', 'sweep:3|created:3',
    'actual', v_actual,
    'pass', v_actual = 'sweep:3|created:3'
  ));

  -- 12. Dropped-prompt data: cancel inside the validity window, quote expired, no cart.
  IF EXISTS (
       SELECT 1
       FROM betk.order_items AS i
       JOIN betk.seller_orders AS s ON s.id = i.order_id
       JOIN betk.inquiries AS q ON q.id = i.inquiry_id
       JOIN betk.order_status_history AS h ON h.order_id = s.id
       WHERE i.inquiry_id = v_iq_drop
         AND i.is_custom = true
         AND s.master_order_id = v_master_main
         AND s.status = 'cancelled'::betk.order_status
         AND q.quote_expires_at IS NOT NULL
         AND q.quote_expires_at <= now()
         AND q.status IS DISTINCT FROM 'declined'::betk.inquiry_status
         AND h.to_status = 'cancelled'::betk.order_status
         AND h.notes = 'payment_window_expired'
         AND h.created_at <= now()
         AND h.created_at >= now() - make_interval(hours => 24)
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.cart_items AS c
       WHERE c.inquiry_id = v_iq_drop
     )
     AND (SELECT value FROM betk.admin_settings WHERE key = 'quote_validity_hours') = '24' THEN
    v_actual := 'in_window|quote_expired|no_cart';
  ELSE
    v_actual := 'missing';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_dropped_prompt',
    'expected', 'in_window|quote_expired|no_cart',
    'actual', v_actual,
    'pass', v_actual = 'in_window|quote_expired|no_cart'
  ));

  -- 13. Three pending children, three sweep history rows, one notification.
  SELECT
    (SELECT count(*) FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_main
        AND s.status = 'cancelled'::betk.order_status
        AND s.cancelled_by = 'system'::betk.cancelled_by_type)::text
    || '|' ||
    (SELECT count(*) FROM betk.order_status_history AS h
      JOIN betk.seller_orders AS s ON s.id = h.order_id
      WHERE s.master_order_id = v_master_main
        AND h.notes = 'payment_window_expired')::text
    || '|' ||
    (SELECT count(*) FROM betk.notifications AS n
      WHERE n.user_id = v_buyer_main
        AND n.type = 'payment_window_expired'
        AND n.data->>'master_order_id' = v_master_main::text)::text
  INTO v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_three_stores',
    'expected', '3|3|1',
    'actual', v_actual,
    'pass', v_actual = '3|3|1'
  ));

  -- 14. A non-pending child is untouched and gets no history row.
  IF EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       WHERE s.id = v_child_kept
         AND s.status = 'confirmed'::betk.order_status
         AND s.cancelled_by IS NULL
     )
     AND NOT EXISTS (
       SELECT 1
       FROM betk.order_status_history AS h
       WHERE h.order_id = v_child_kept
     )
     AND EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       WHERE s.id = v_child_pending
         AND s.status = 'cancelled'::betk.order_status
     ) THEN
    v_actual := 'confirmed|0';
  ELSE
    v_actual := 'touched';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_mixed_children',
    'expected', 'confirmed|0',
    'actual', v_actual,
    'pass', v_actual = 'confirmed|0'
  ));

  -- 15. The colliding master stays pending. The later master is swept.
  IF EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       JOIN betk.listings AS l ON l.id = v_list_fail
       WHERE s.master_order_id = v_master_fail
         AND s.status = 'pending'::betk.order_status
         AND s.cancelled_by IS NULL
         AND l.stock_qty = 4
     )
     AND (
       SELECT count(*)
       FROM betk.cart_items AS c
       WHERE c.buyer_id = v_buyer_iso
         AND c.listing_id = v_list_fail
         AND c.inquiry_id IS NULL
     ) = 1
     AND NOT EXISTS (
       SELECT 1
       FROM betk.order_status_history AS h
       JOIN betk.seller_orders AS s ON s.id = h.order_id
       WHERE s.master_order_id = v_master_fail
         AND h.notes = 'payment_window_expired'
     )
     AND EXISTS (
       SELECT 1
       FROM betk.seller_orders AS s
       JOIN betk.listings AS l ON l.id = v_list_ok
       WHERE s.master_order_id = v_master_ok
         AND s.status = 'cancelled'::betk.order_status
         AND s.cancelled_by = 'system'::betk.cancelled_by_type
         AND l.stock_qty = 5
     )
     AND (
       SELECT count(*)
       FROM betk.order_status_history AS h
       JOIN betk.seller_orders AS s ON s.id = h.order_id
       WHERE s.master_order_id = v_master_ok
         AND h.notes = 'payment_window_expired'
     ) = 1
     AND (
       SELECT count(*)
       FROM betk.notifications AS n
       WHERE n.data->>'master_order_id' = v_master_ok::text
         AND n.type = 'payment_window_expired'
     ) = 1 THEN
    v_actual := 'pending|cancelled';
  ELSE
    v_actual := 'not_isolated';
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_warning_isolates',
    'expected', 'pending|cancelled',
    'actual', v_actual,
    'pass', v_actual = 'pending|cancelled'
  ));

  -- 16. A second call changes nothing and adds no notification or history.
  SELECT
    (SELECT l.stock_qty FROM betk.listings AS l WHERE l.id = v_list_fixed)::text
    || '|' ||
    (SELECT count(*) FROM betk.cart_items AS c WHERE c.buyer_id = v_buyer_main)::text
    || '|' ||
    (SELECT count(*) FROM betk.order_status_history AS h
      JOIN betk.seller_orders AS s ON s.id = h.order_id
      WHERE s.master_order_id = v_master_main
        AND h.notes = 'payment_window_expired')::text
    || '|' ||
    (SELECT count(*) FROM betk.notifications AS n
      WHERE n.data->>'master_order_id' = v_master_main::text)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_fail)::text
    || '|' ||
    (SELECT l.stock_qty FROM betk.listings AS l WHERE l.id = v_list_fail)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_ok)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_proof)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_future)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_null)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s WHERE s.id = v_child_kept)::text
  INTO v_fp;
  IF auth.uid() IS NOT NULL OR current_user IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'BETK_P11_SWEEP_OWNER';
  END IF;
  PERFORM betk.sweep_expired_payment_windows();
  SELECT
    (SELECT l.stock_qty FROM betk.listings AS l WHERE l.id = v_list_fixed)::text
    || '|' ||
    (SELECT count(*) FROM betk.cart_items AS c WHERE c.buyer_id = v_buyer_main)::text
    || '|' ||
    (SELECT count(*) FROM betk.order_status_history AS h
      JOIN betk.seller_orders AS s ON s.id = h.order_id
      WHERE s.master_order_id = v_master_main
        AND h.notes = 'payment_window_expired')::text
    || '|' ||
    (SELECT count(*) FROM betk.notifications AS n
      WHERE n.data->>'master_order_id' = v_master_main::text)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_fail)::text
    || '|' ||
    (SELECT l.stock_qty FROM betk.listings AS l WHERE l.id = v_list_fail)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_ok)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_proof)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_future)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s
      WHERE s.master_order_id = v_master_null)::text
    || '|' ||
    (SELECT s.status::text FROM betk.seller_orders AS s WHERE s.id = v_child_kept)::text
  INTO v_fp2;
  IF v_fp = v_fp2
     AND split_part(v_fp, '|', 3) = '3'
     AND split_part(v_fp, '|', 4) = '1' THEN
    v_actual := 'unchanged';
  ELSE
    v_actual := coalesce(v_fp, 'none') || '>' || coalesce(v_fp2, 'none');
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_second_run',
    'expected', 'unchanged',
    'actual', v_actual,
    'pass', v_actual = 'unchanged'
  ));

  -- Park the colliding master so the limit set is the only candidate.
  UPDATE betk.master_orders
  SET payment_deadline = now() + interval '2 hours'
  WHERE id = v_master_fail;
  SELECT count(*)::integer INTO v_candidates
  FROM betk.master_orders AS m
  WHERE m.payment_deadline IS NOT NULL
    AND m.payment_deadline < now()
    AND m.proof_path IS NULL
    AND EXISTS (
      SELECT 1
      FROM betk.seller_orders AS s
      WHERE s.master_order_id = m.id
        AND s.status = 'pending'::betk.order_status
    );
  IF v_candidates <> 0 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_CANDIDATES %', v_candidates;
  END IF;

  INSERT INTO betk.master_orders (
    buyer_id, betk_ref, combined_delivery_total, proof_path, payment_deadline
  )
  SELECT
    v_buyer_limit,
    'CI-L-' || lpad(g.i::text, 4, '0'),
    0,
    NULL,
    now() - ((102 - g.i) * interval '1 minute')
  FROM generate_series(1, 101) AS g(i);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 101 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_LIMIT_MASTERS %', v_n;
  END IF;
  INSERT INTO betk.seller_orders (
    buyer_id, store_id, delivery_method, delivery_fee, subtotal, total_amount,
    status, master_order_id
  )
  SELECT
    v_buyer_limit,
    v_store_a,
    'delivery'::betk.delivery_preference,
    0,
    10,
    10,
    'pending'::betk.order_status,
    m.id
  FROM betk.master_orders AS m
  WHERE m.buyer_id = v_buyer_limit
    AND m.betk_ref LIKE 'CI-L-%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 101 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_LIMIT_CHILDREN %', v_n;
  END IF;

  SELECT count(*)::integer INTO v_candidates
  FROM betk.master_orders AS m
  WHERE m.payment_deadline IS NOT NULL
    AND m.payment_deadline < now()
    AND m.proof_path IS NULL
    AND EXISTS (
      SELECT 1
      FROM betk.seller_orders AS s
      WHERE s.master_order_id = m.id
        AND s.status = 'pending'::betk.order_status
    );
  IF v_candidates <> 101 THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_LIMIT_CANDIDATES %', v_candidates;
  END IF;

  PERFORM betk.sweep_expired_payment_windows();

  SELECT count(*)::integer INTO v_candidates
  FROM betk.master_orders AS m
  WHERE m.payment_deadline IS NOT NULL
    AND m.payment_deadline < now()
    AND m.proof_path IS NULL
    AND EXISTS (
      SELECT 1
      FROM betk.seller_orders AS s
      WHERE s.master_order_id = m.id
        AND s.status = 'pending'::betk.order_status
    );
  IF NOT (
       v_candidates = 1
       AND EXISTS (
         SELECT 1
         FROM betk.master_orders AS m
         JOIN betk.seller_orders AS s ON s.master_order_id = m.id
         WHERE m.buyer_id = v_buyer_limit
           AND m.betk_ref = 'CI-L-0101'
           AND s.status = 'pending'::betk.order_status
       )
       AND (
         SELECT count(*)
         FROM betk.master_orders AS m
         JOIN betk.seller_orders AS s ON s.master_order_id = m.id
         WHERE m.buyer_id = v_buyer_limit
           AND m.betk_ref <> 'CI-L-0101'
           AND s.status = 'cancelled'::betk.order_status
           AND m.payment_deadline < (
             SELECT m2.payment_deadline
             FROM betk.master_orders AS m2
             WHERE m2.buyer_id = v_buyer_limit
               AND m2.betk_ref = 'CI-L-0101'
           )
       ) = 100
     ) THEN
    v_actual := 'first:' || coalesce(v_candidates::text, '0');
  ELSE
    PERFORM betk.sweep_expired_payment_windows();
    SELECT count(*)::integer INTO v_candidates
    FROM betk.master_orders AS m
    WHERE m.payment_deadline IS NOT NULL
      AND m.payment_deadline < now()
      AND m.proof_path IS NULL
      AND EXISTS (
        SELECT 1
        FROM betk.seller_orders AS s
        WHERE s.master_order_id = m.id
          AND s.status = 'pending'::betk.order_status
      );
    IF v_candidates = 0
       AND EXISTS (
         SELECT 1
         FROM betk.seller_orders AS s
         JOIN betk.master_orders AS m ON m.id = s.master_order_id
         WHERE m.betk_ref = 'CI-L-0101'
           AND s.status = 'cancelled'::betk.order_status
           AND s.cancelled_by = 'system'::betk.cancelled_by_type
       )
       AND (
         SELECT count(*)
         FROM betk.order_status_history AS h
         JOIN betk.seller_orders AS s ON s.id = h.order_id
         JOIN betk.master_orders AS m ON m.id = s.master_order_id
         WHERE m.betk_ref = 'CI-L-0101'
           AND h.notes = 'payment_window_expired'
       ) = 1 THEN
      v_actual := '100|1';
    ELSE
      v_actual := 'second:' || coalesce(v_candidates::text, '0');
    END IF;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'sweep_limit',
    'expected', '100|1',
    'actual', v_actual,
    'pass', v_actual = '100|1'
  ));

  DELETE FROM betk.courier_rates WHERE id = v_rate;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 OR EXISTS (SELECT 1 FROM betk.courier_rates) THEN
    RAISE EXCEPTION 'BETK_P11_FIXTURE_RATE';
  END IF;

  SELECT coalesce(bool_and((e->>'pass')::boolean), false), count(*)::integer
  INTO v_all, v_n
  FROM jsonb_array_elements(v_rows) AS e;
  v_actual := v_all::text || '|' || v_n::text;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'all_pass',
    'expected', 'true|17',
    'actual', v_actual,
    'pass', v_actual = 'true|17'
  ));

  PERFORM set_config('p11.sweep_results', v_rows::text, true);
END;
$cases$;

SELECT r.name, r.expected, r.actual, r.pass
FROM jsonb_to_recordset(current_setting('p11.sweep_results')::jsonb)
  AS r(name text, expected text, actual text, pass boolean);

ROLLBACK;
