-- T02 CI proof of P10M1 on the local stack only.
-- One result set: name, expected, actual, pass.
-- CASE_COUNT is 41 recorded cases. all_pass checks that count.
-- Do not change an expected value to match a wrong actual.
--
-- This file issues no DDL and disables no protection. No CREATE, ALTER,
-- DROP, GRANT, REVOKE, DISABLE TRIGGER, DISABLE RULE, or
-- session_replication_role. Fixture writes are DML in this transaction.
-- The closing ROLLBACK undoes them. It does not DELETE an append-only row.
--
-- payment_window_minutes, the price-band keys, and
-- agreement_seller_agreement_version are CI TEST VALUE writes in this
-- transaction only. They are not staging values. quote_validity_hours
-- stays the seeded 24. quote_tolerance_multiplier stays the seeded 2.
--
-- Sources: PHASE_10_CART_QUOTE.md T02, §5 writer inventory, §6 R-LOCK,
-- R-FREEZE, R-AVAIL, R-DECLINED, R-TRIGGER, R-107. computeAvgResponseHours
-- is messagingRules.ts lines 82-98. markInquiryRead updates is_read on the
-- other party's unread messages. resubmit_seller_application,
-- approveSellerApplication, and rejectSellerApplication are the re-grant
-- shapes.

SET TIME ZONE 'UTC';
SET search_path TO betk, public;

BEGIN;

DO $cases$
DECLARE
  v_buyer uuid := 'c1000000-0000-4000-8000-000000000001';
  v_seller uuid := 'c1000000-0000-4000-8000-000000000002';
  v_susp uuid := 'c1000000-0000-4000-8000-000000000003';
  v_formula uuid := 'c1000000-0000-4000-8000-000000000004';
  v_applicant uuid := 'c1000000-0000-4000-8000-000000000005';
  v_approve uuid := 'c1000000-0000-4000-8000-000000000006';
  v_reject uuid := 'c1000000-0000-4000-8000-000000000007';
  v_admin uuid := 'c1000000-0000-4000-8000-000000000008';
  v_store uuid := 'c2000000-0000-4000-8000-000000000001';
  v_susp_store uuid := 'c2000000-0000-4000-8000-000000000002';
  v_formula_store uuid := 'c2000000-0000-4000-8000-000000000003';
  v_fixed uuid := 'c3000000-0000-4000-8000-000000000001';
  v_over uuid := 'c3000000-0000-4000-8000-000000000002';
  v_mto uuid := 'c3000000-0000-4000-8000-000000000003';
  v_inelig uuid := 'c3000000-0000-4000-8000-000000000004';
  v_paused uuid := 'c3000000-0000-4000-8000-000000000005';
  v_deleted uuid := 'c3000000-0000-4000-8000-000000000006';
  v_susp_listing uuid := 'c3000000-0000-4000-8000-000000000007';
  v_formula_listing uuid := 'c3000000-0000-4000-8000-000000000008';
  v_iq_ok uuid := 'c4000000-0000-4000-8000-000000000001';
  v_iq_below uuid := 'c4000000-0000-4000-8000-000000000002';
  v_iq_above uuid := 'c4000000-0000-4000-8000-000000000003';
  v_iq_prep uuid := 'c4000000-0000-4000-8000-000000000004';
  v_iq_inelig uuid := 'c4000000-0000-4000-8000-000000000005';
  v_iq_expired uuid := 'c4000000-0000-4000-8000-000000000006';
  v_iq_paused uuid := 'c4000000-0000-4000-8000-000000000007';
  v_iq_deleted uuid := 'c4000000-0000-4000-8000-000000000008';
  v_iq_susp uuid := 'c4000000-0000-4000-8000-000000000009';
  v_iq_replied uuid := 'c4000000-0000-4000-8000-00000000000a';
  v_iq_declined uuid := 'c4000000-0000-4000-8000-00000000000b';
  v_iq_formula uuid := 'c4000000-0000-4000-8000-00000000000c';
  v_address uuid := 'c5000000-0000-4000-8000-000000000001';
  v_cart uuid;
  v_arts uuid;
  v_msg text;
  v_state text;
  v_actual text;
  v_send text;
  v_accept text;
  v_rows jsonb := '[]'::jsonb;
  v_all boolean;
  v_n integer;
  v_m1 text;
  v_m2 text;
  v_m3 text;
  v_m4 text;
  v_m5 text;
  v_m6 text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  IF (SELECT value FROM betk.admin_settings WHERE key = 'quote_validity_hours')
       IS DISTINCT FROM '24'
     OR (SELECT value FROM betk.admin_settings WHERE key = 'quote_tolerance_multiplier')
       IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_SETTINGS';
  END IF;
  IF EXISTS (SELECT 1 FROM betk.courier_rates) THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_RATES';
  END IF;

  -- CI TEST VALUE. Local transaction only. Not the staging band or agreement.
  UPDATE betk.admin_settings SET value = '10' WHERE key = 'price_band_min_egp';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_BAND';
  END IF;
  UPDATE betk.admin_settings SET value = '100' WHERE key = 'price_band_max_egp';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_BAND';
  END IF;
  UPDATE betk.admin_settings SET value = 'CI-P10' WHERE key = 'agreement_seller_agreement_version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_AGREEMENT';
  END IF;

  SELECT id INTO v_arts FROM betk.categories WHERE slug = 'arts-crafts';
  IF v_arts IS NULL THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_CATEGORY';
  END IF;

  INSERT INTO betk.users (id, role, status, phone_number) VALUES
    (v_buyer, 'buyer', 'active', '01093000001'),
    (v_seller, 'seller', 'active', '01093000002'),
    (v_susp, 'seller', 'active', '01093000003'),
    (v_formula, 'seller', 'active', '01093000004'),
    (v_applicant, 'seller', 'active', '01093000005'),
    (v_approve, 'seller', 'active', '01093000006'),
    (v_reject, 'seller', 'active', '01093000007'),
    (v_admin, 'admin', 'active', '01093000008');

  INSERT INTO betk.seller_profiles (id, status) VALUES
    (v_seller, 'active'),
    (v_susp, 'active'),
    (v_formula, 'active');
  INSERT INTO betk.seller_profiles (id, status, rejected_reason, submitted_at)
  VALUES (v_applicant, 'pending', 'ci-old', timestamptz '2020-01-01 00:00:00+00');
  INSERT INTO betk.seller_profiles (id, status) VALUES
    (v_approve, 'pending'),
    (v_reject, 'pending');

  INSERT INTO betk.stores (
    id, seller_id, name_ar, slug, governorate, city, category_primary, status
  ) VALUES
    (v_store, v_seller, 'CI A', 'ci-p10-a', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_susp_store, v_susp, 'CI B', 'ci-p10-b', 'Cairo', 'Cairo', 'ci', 'active'),
    (v_formula_store, v_formula, 'CI C', 'ci-p10-c', 'Cairo', 'Cairo', 'ci', 'active');

  -- The insert trigger clears approved_at unless the caller is an admin.
  -- The stamp is an UPDATE, which that trigger does not touch.
  INSERT INTO betk.store_categories (store_id, category_id) VALUES
    (v_store, v_arts),
    (v_susp_store, v_arts);
  UPDATE betk.store_categories
  SET approved_at = timestamptz '2026-01-15 00:00:00+00'
  WHERE category_id = v_arts
    AND store_id IN (v_store, v_susp_store);

  INSERT INTO betk.listings (
    id, store_id, category_id, title_ar, type, price_type, price, stock_qty,
    is_made_to_order, status, weight_g, length_mm, width_mm, height_mm, prep_days
  ) VALUES
    (v_fixed, v_store, v_arts, 'CI fixed', 'product', 'fixed', 50, 5,
     false, 'active', 100, 10, 10, 10, 1),
    (v_over, v_store, v_arts, 'CI over', 'product', 'fixed', 50, 2,
     false, 'active', 100, 10, 10, 10, 1),
    (v_mto, v_store, v_arts, 'CI mto', 'product', 'fixed', 50, NULL,
     true, 'active', 100, 10, 10, 10, 1),
    (v_inelig, v_store, v_arts, 'CI inelig', 'product', 'fixed', 50, NULL,
     false, 'active', 100, 10, 10, 10, 1),
    (v_deleted, v_store, v_arts, 'CI deleted', 'product', 'fixed', 50, NULL,
     false, 'active', 100, 10, 10, 10, 1),
    (v_susp_listing, v_susp_store, v_arts, 'CI susp', 'product', 'fixed', 50, NULL,
     false, 'active', 100, 10, 10, 10, 1);

  INSERT INTO betk.listings (
    id, store_id, category_id, title_ar, type, price_type, price, status
  ) VALUES
    (v_paused, v_store, v_arts, 'CI paused', 'product', 'fixed', 50, 'paused'),
    (v_formula_listing, v_formula_store, v_arts, 'CI formula', 'product', 'fixed', 50, 'draft');

  UPDATE betk.listings SET deleted_at = now() WHERE id = v_deleted;
  UPDATE betk.stores SET status = 'suspended' WHERE id = v_susp_store;

  INSERT INTO betk.inquiries (
    id, buyer_id, store_id, listing_id, quantity, buyer_first_message
  ) VALUES
    (v_iq_ok, v_buyer, v_store, v_mto, 1, 'ci'),
    (v_iq_below, v_buyer, v_store, v_mto, 1, 'ci'),
    (v_iq_above, v_buyer, v_store, v_mto, 1, 'ci'),
    (v_iq_prep, v_buyer, v_store, v_mto, 1, 'ci'),
    (v_iq_inelig, v_buyer, v_store, v_inelig, 1, 'ci'),
    (v_iq_expired, v_buyer, v_store, v_mto, 1, 'ci'),
    (v_iq_paused, v_buyer, v_store, v_paused, 1, 'ci'),
    (v_iq_deleted, v_buyer, v_store, v_deleted, 1, 'ci'),
    (v_iq_susp, v_buyer, v_susp_store, v_susp_listing, 1, 'ci'),
    (v_iq_replied, v_buyer, v_store, v_fixed, 1, 'ci'),
    (v_iq_declined, v_buyer, v_store, v_fixed, 1, 'ci');

  INSERT INTO betk.inquiries (
    id, buyer_id, store_id, listing_id, quantity, buyer_first_message, created_at
  ) VALUES (
    v_iq_formula, v_buyer, v_formula_store, v_formula_listing, 1, 'ci',
    timestamptz '2026-03-01 00:00:00+00'
  );

  UPDATE betk.inquiries
  SET quoted_price = 80,
      quoted_prep_days = 1,
      quoted_at = now(),
      quote_expires_at = now() + interval '48 hours'
  WHERE id IN (v_iq_paused, v_iq_deleted, v_iq_susp);

  UPDATE betk.inquiries
  SET quoted_price = 80,
      quoted_prep_days = 1,
      quoted_at = now() - interval '48 hours',
      quote_expires_at = now() - interval '1 hour'
  WHERE id = v_iq_expired;

  INSERT INTO betk.addresses (id, buyer_id, governorate, city, street_address)
  VALUES (v_address, v_buyer, 'CI-NOWHERE', 'CI', '1');

  INSERT INTO betk.agreement_acceptances (user_id, document, version_label, status)
  VALUES (v_applicant, 'seller_agreement', 'CI-P10', 'accepted');

  INSERT INTO betk.seller_documents (seller_id, document_type, storage_path)
  VALUES
    (v_applicant, 'national_id_front', 'ci/p10-front'),
    (v_applicant, 'national_id_back', 'ci/p10-back');

  INSERT INTO betk.inquiry_messages (
    inquiry_id, sender_id, sender_type, body, is_read
  ) VALUES (
    v_iq_replied, v_buyer, 'buyer', 'ci', false
  );

  -- 1. Add refuses a guest (auth.uid() null). The role can execute the function.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 1::smallint)', v_fixed);
    v_msg := 'ok';
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    v_state := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*)::text INTO v_actual FROM betk.cart_items;
  v_actual := v_msg || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_guest', 'expected', 'BETK_UNAUTHENTICATED|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_UNAUTHENTICATED|0'
  ));

  -- 2. Add refuses a quantity above tracked stock.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 3::smallint)', v_over);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE listing_id = v_over;
  v_actual := v_msg || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_over_stock', 'expected', 'BETK_CART_OUT_OF_STOCK|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_CART_OUT_OF_STOCK|0'
  ));

  -- 3. Direct buyer INSERT is refused.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'INSERT INTO betk.cart_items (buyer_id, listing_id, quantity, unit_price, is_custom)
       VALUES (%L, %L, 1, 50, false)',
      v_buyer, v_fixed
    );
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*)::text INTO v_actual FROM betk.cart_items;
  v_actual := v_state || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'cart_buyer_insert_refused', 'expected', '42501|0',
    'actual', v_actual, 'pass', v_actual = '42501|0'
  ));

  -- 4-7. Direct seller UPDATE of each quote column is refused.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('UPDATE betk.inquiries SET quoted_price = 80 WHERE id = %L', v_iq_ok);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
  END;
  BEGIN
    EXECUTE format('UPDATE betk.inquiries SET quoted_prep_days = 1 WHERE id = %L', v_iq_ok);
    v_msg := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLSTATE;
  END;
  BEGIN
    EXECUTE format(
      'UPDATE betk.inquiries SET quote_expires_at = now() + interval ''2 days'' WHERE id = %L',
      v_iq_ok
    );
    v_send := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_send := SQLSTATE;
  END;
  BEGIN
    EXECUTE format('UPDATE betk.inquiries SET quoted_at = now() WHERE id = %L', v_iq_ok);
    v_accept := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_accept := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_ok;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_col_quoted_price_refused', 'expected', '42501|null',
    'actual', v_state || '|' || v_actual, 'pass', v_state = '42501' AND v_actual = 'null'
  ));
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_col_prep_refused', 'expected', '42501|null',
    'actual', v_msg || '|' || v_actual, 'pass', v_msg = '42501' AND v_actual = 'null'
  ));
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_col_expires_refused', 'expected', '42501|null',
    'actual', v_send || '|' || v_actual, 'pass', v_send = '42501' AND v_actual = 'null'
  ));
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_col_quoted_at_refused', 'expected', '42501|null',
    'actual', v_accept || '|' || v_actual, 'pass', v_accept = '42501' AND v_actual = 'null'
  ));

  -- 8-9. Owning seller sets status to replied, and to declined.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'UPDATE betk.inquiries SET status = %L::betk.inquiry_status WHERE id = %L',
      'replied', v_iq_replied
    );
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  BEGIN
    EXECUTE format(
      'UPDATE betk.inquiries SET status = %L::betk.inquiry_status WHERE id = %L',
      'declined', v_iq_declined
    );
    v_send := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_send := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT status::text INTO v_actual FROM betk.inquiries WHERE id = v_iq_replied;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'seller_status_replied', 'expected', 'replied',
    'actual', v_actual, 'pass', v_actual = 'replied'
  ));
  IF v_send <> 'ok' THEN
    v_actual := v_send;
  ELSE
    SELECT status::text INTO v_actual FROM betk.inquiries WHERE id = v_iq_declined;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'seller_status_declined', 'expected', 'declined',
    'actual', v_actual, 'pass', v_actual = 'declined'
  ));

  -- 10. inquiry_messages.is_read, markInquiryRead shape: the receiver flips
  -- the other party's unread row.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'UPDATE betk.inquiry_messages SET is_read = true
       WHERE inquiry_id = %L AND sender_id <> %L AND is_read = false',
      v_iq_replied, v_seller
    );
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT CASE WHEN count(*) = 1 AND bool_and(is_read) THEN 'true' ELSE 'false' END
    INTO v_actual
    FROM betk.inquiry_messages
    WHERE inquiry_id = v_iq_replied AND sender_id = v_buyer;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'inquiry_message_is_read', 'expected', 'true',
    'actual', v_actual, 'pass', v_actual = 'true'
  ));

  -- 11-14. Quote refusals store nothing.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 49::numeric, 1::smallint)', v_iq_below);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 101::numeric, 1::smallint)', v_iq_above);
    v_state := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 80::numeric, NULL::smallint)', v_iq_prep);
    v_send := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_send := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 80::numeric, 1::smallint)', v_iq_inelig);
    v_accept := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_accept := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_below;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_below_band', 'expected', 'BETK_QUOTE_OUT_OF_BAND|null',
    'actual', v_msg || '|' || v_actual, 'pass', v_msg = 'BETK_QUOTE_OUT_OF_BAND' AND v_actual = 'null'
  ));
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_above;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_above_band', 'expected', 'BETK_QUOTE_OUT_OF_BAND|null',
    'actual', v_state || '|' || v_actual, 'pass', v_state = 'BETK_QUOTE_OUT_OF_BAND' AND v_actual = 'null'
  ));
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_prep;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_missing_prep', 'expected', 'BETK_QUOTE_PREP_REQUIRED|null',
    'actual', v_send || '|' || v_actual, 'pass', v_send = 'BETK_QUOTE_PREP_REQUIRED' AND v_actual = 'null'
  ));
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_inelig;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_listing_ineligible', 'expected', 'BETK_QUOTE_LISTING_INELIGIBLE|null',
    'actual', v_accept || '|' || v_actual,
    'pass', v_accept = 'BETK_QUOTE_LISTING_INELIGIBLE' AND v_actual = 'null'
  ));

  -- 15. Accept refuses an expired quote and inserts nothing.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_expired);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE inquiry_id = v_iq_expired;
  v_actual := v_msg || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'accept_expired', 'expected', 'BETK_QUOTE_EXPIRED|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_EXPIRED|0'
  ));

  -- 16. In-band quote on a made-to-order listing. Expiry is quoted_at plus
  -- the seeded quote_validity_hours (24).
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 80::numeric, 1::smallint)', v_iq_ok);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT CASE
      WHEN quoted_price = 80
       AND quoted_prep_days = 1
       AND quoted_at IS NOT NULL
       AND quote_expires_at = quoted_at + make_interval(hours => 24)
       AND (SELECT btrim(value) FROM betk.admin_settings WHERE key = 'quote_validity_hours') = '24'
      THEN '24h'
      ELSE coalesce(quoted_price::text, 'null')
    END
    INTO v_actual
    FROM betk.inquiries
    WHERE id = v_iq_ok;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_mto_expires_at', 'expected', '24h',
    'actual', v_actual, 'pass', v_actual = '24h'
  ));

  -- 17-18. In-stock add stores one line at listings.price. Quantity change
  -- leaves that price.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 1::smallint)', v_fixed);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
    v_cart := NULL;
  ELSE
    SELECT
      count(*)::text || '|' ||
      CASE WHEN count(*) = 1 AND bool_and(c.unit_price = l.price AND l.price = 50)
           THEN '50.00' ELSE 'mismatch' END || '|' ||
      min(c.quantity)::text,
      min(c.id)
    INTO v_actual, v_cart
    FROM betk.cart_items AS c
    JOIN betk.listings AS l ON l.id = c.listing_id
    WHERE c.buyer_id = v_buyer AND c.listing_id = v_fixed AND c.inquiry_id IS NULL;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_within_stock', 'expected', '1|50.00|1',
    'actual', v_actual, 'pass', v_actual = '1|50.00|1'
  ));

  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.set_cart_item_quantity(%L, 2::smallint)', v_cart);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT
      count(*)::text || '|' ||
      CASE WHEN count(*) = 1 AND bool_and(c.unit_price = 50) THEN '50.00' ELSE 'mismatch' END || '|' ||
      min(c.quantity)::text
    INTO v_actual
    FROM betk.cart_items AS c
    WHERE c.id = v_cart;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'set_quantity_keeps_price', 'expected', '1|50.00|2',
    'actual', v_actual, 'pass', v_actual = '1|50.00|2'
  ));

  -- 19-20. Direct buyer UPDATE of quantity, and of unit_price, stays refused.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('UPDATE betk.cart_items SET quantity = 9 WHERE id = %L', v_cart);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
  END;
  BEGIN
    EXECUTE format('UPDATE betk.cart_items SET unit_price = 1 WHERE id = %L', v_cart);
    v_msg := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT
    CASE WHEN quantity = 2 THEN '2' ELSE coalesce(quantity::text, 'null') END || '|' ||
    CASE WHEN unit_price = 50 THEN '50.00' ELSE coalesce(unit_price::text, 'null') END
  INTO v_actual
  FROM betk.cart_items
  WHERE id = v_cart;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'cart_buyer_update_quantity_refused', 'expected', '42501|2|50.00',
    'actual', v_state || '|' || v_actual, 'pass', v_state = '42501' AND v_actual = '2|50.00'
  ));
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'cart_buyer_update_unit_price_refused', 'expected', '42501|2|50.00',
    'actual', v_msg || '|' || v_actual, 'pass', v_msg = '42501' AND v_actual = '2|50.00'
  ));

  -- 21. Direct avg_response_hours write is refused. Value stays null.
  PERFORM set_config('request.jwt.claim.sub', v_formula::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_formula, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'UPDATE betk.seller_profiles SET avg_response_hours = 9.99 WHERE id = %L',
      v_formula
    );
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT coalesce(avg_response_hours::text, 'null') INTO v_actual
  FROM betk.seller_profiles WHERE id = v_formula;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'avg_direct_write_refused', 'expected', '42501|null',
    'actual', v_state || '|' || v_actual, 'pass', v_state = '42501' AND v_actual = 'null'
  ));

  -- 22. Seller message. Gap is 2 hours. Formula: round(mean, 2), then cap.
  PERFORM set_config('request.jwt.claim.sub', v_formula::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_formula, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'INSERT INTO betk.inquiry_messages (inquiry_id, sender_id, sender_type, body, sent_at)
       VALUES (%L, %L, %L::betk.sender_type, %L, timestamptz %L)',
      v_iq_formula, v_formula, 'seller', 'ci', '2026-03-01 02:00:00+00'
    );
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT CASE WHEN avg_response_hours = 2.00 THEN '2.00' ELSE coalesce(avg_response_hours::text, 'null') END
    INTO v_actual
    FROM betk.seller_profiles WHERE id = v_formula;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'trigger_formula', 'expected', '2.00',
    'actual', v_actual, 'pass', v_actual = '2.00'
  ));

  -- 23. A buyer message does not fire the recompute. The owner sets a
  -- sentinel after the formula row. A firing trigger would store 2.00 again.
  UPDATE betk.seller_profiles SET avg_response_hours = 7.00 WHERE id = v_formula;
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'INSERT INTO betk.inquiry_messages (inquiry_id, sender_id, sender_type, body, sent_at)
       VALUES (%L, %L, %L::betk.sender_type, %L, timestamptz %L)',
      v_iq_formula, v_buyer, 'buyer', 'ci', '2026-03-01 12:00:00+00'
    );
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_msg <> 'ok' THEN
    v_actual := v_msg;
  ELSE
    SELECT CASE WHEN avg_response_hours = 7.00 THEN 'sentinel' ELSE 'recomputed|' || coalesce(avg_response_hours::text, 'null') END
    INTO v_actual
    FROM betk.seller_profiles WHERE id = v_formula;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'buyer_message_no_recompute', 'expected', 'sentinel',
    'actual', v_actual, 'pass', v_actual = 'sentinel'
  ));

  -- 24-25. Re-quote while a line is held stores nothing. Remove the line,
  -- then a fresh in-band quote and accept store the new quote and one line.
  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  ) VALUES (
    v_buyer, v_mto, 1, 80, true, v_iq_ok
  );
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 60::numeric, 1::smallint)', v_iq_ok);
    v_msg := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT CASE WHEN quoted_price = 80 THEN '80.00' ELSE coalesce(quoted_price::text, 'null') END
  INTO v_actual
  FROM betk.inquiries WHERE id = v_iq_ok;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_line_held', 'expected', 'BETK_QUOTE_LINE_HELD|80.00',
    'actual', v_msg || '|' || v_actual,
    'pass', v_msg = 'BETK_QUOTE_LINE_HELD' AND v_actual = '80.00'
  ));

  DELETE FROM betk.cart_items WHERE inquiry_id = v_iq_ok;
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 90::numeric, 1::smallint)', v_iq_ok);
    v_send := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_send := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_ok);
    v_accept := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_accept := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_send <> 'ok' OR v_accept <> 'ok' THEN
    v_actual := v_send || '|' || v_accept;
  ELSE
    SELECT
      CASE WHEN i.quoted_price = 90 THEN '90.00' ELSE coalesce(i.quoted_price::text, 'null') END
      || '|' || count(c.id)::text || '|' ||
      CASE WHEN count(c.id) = 1 AND bool_and(c.is_custom AND c.unit_price = i.quoted_price)
           THEN 'custom' ELSE 'bad' END
    INTO v_actual
    FROM betk.inquiries AS i
    LEFT JOIN betk.cart_items AS c ON c.inquiry_id = i.id
    WHERE i.id = v_iq_ok
    GROUP BY i.quoted_price;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'quote_line_released', 'expected', '90.00|1|custom',
    'actual', v_actual, 'pass', v_actual = '90.00|1|custom'
  ));

  -- 26-31. Buyer: not active, deleted, or a suspended store. Nothing stored.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 1::smallint)', v_paused);
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 1::smallint)', v_deleted);
    v_m2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m2 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.add_fixed_cart_item(%L, 1::smallint)', v_susp_listing);
    v_m3 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m3 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_paused);
    v_m4 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m4 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_deleted);
    v_m5 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m5 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_susp);
    v_m6 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m6 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE listing_id = v_paused;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_listing_inactive', 'expected', 'BETK_CART_LISTING_UNAVAILABLE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_CART_LISTING_UNAVAILABLE|0'
  ));
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE listing_id = v_deleted;
  v_actual := v_m2 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_listing_deleted', 'expected', 'BETK_CART_LISTING_UNAVAILABLE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_CART_LISTING_UNAVAILABLE|0'
  ));
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE listing_id = v_susp_listing;
  v_actual := v_m3 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'add_store_suspended', 'expected', 'BETK_CART_STORE_INACTIVE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_CART_STORE_INACTIVE|0'
  ));
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE inquiry_id = v_iq_paused;
  v_actual := v_m4 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'accept_listing_inactive', 'expected', 'BETK_QUOTE_LISTING_UNAVAILABLE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_LISTING_UNAVAILABLE|0'
  ));
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE inquiry_id = v_iq_deleted;
  v_actual := v_m5 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'accept_listing_deleted', 'expected', 'BETK_QUOTE_LISTING_UNAVAILABLE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_LISTING_UNAVAILABLE|0'
  ));
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE inquiry_id = v_iq_susp;
  v_actual := v_m6 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'accept_store_suspended', 'expected', 'BETK_QUOTE_STORE_INACTIVE|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_STORE_INACTIVE|0'
  ));

  -- 32-33. Owning seller send on a paused listing and a deleted listing.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 70::numeric, 1::smallint)', v_iq_paused);
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 70::numeric, 1::smallint)', v_iq_deleted);
    v_m2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m2 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT CASE WHEN quoted_price = 80 THEN '80.00' ELSE coalesce(quoted_price::text, 'null') END
  INTO v_actual FROM betk.inquiries WHERE id = v_iq_paused;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'send_listing_inactive', 'expected', 'BETK_QUOTE_LISTING_UNAVAILABLE|80.00',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_LISTING_UNAVAILABLE|80.00'
  ));
  SELECT CASE WHEN quoted_price = 80 THEN '80.00' ELSE coalesce(quoted_price::text, 'null') END
  INTO v_actual FROM betk.inquiries WHERE id = v_iq_deleted;
  v_actual := v_m2 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'send_listing_deleted', 'expected', 'BETK_QUOTE_LISTING_UNAVAILABLE|80.00',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_LISTING_UNAVAILABLE|80.00'
  ));

  -- 34. Suspended-store owner send.
  PERFORM set_config('request.jwt.claim.sub', v_susp::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_susp, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 70::numeric, 1::smallint)', v_iq_susp);
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT CASE WHEN quoted_price = 80 THEN '80.00' ELSE coalesce(quoted_price::text, 'null') END
  INTO v_actual FROM betk.inquiries WHERE id = v_iq_susp;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'send_store_suspended', 'expected', 'BETK_QUOTE_STORE_INACTIVE|80.00',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_STORE_INACTIVE|80.00'
  ));

  -- 35-36. Declined inquiry. Accept and send store nothing.
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.accept_inquiry_quote(%L)', v_iq_declined);
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.send_inquiry_quote(%L, 80::numeric, 1::smallint)', v_iq_declined);
    v_m2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m2 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT count(*)::text INTO v_actual FROM betk.cart_items WHERE inquiry_id = v_iq_declined;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'accept_declined', 'expected', 'BETK_QUOTE_DECLINED|0',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_DECLINED|0'
  ));
  SELECT coalesce(quoted_price::text, 'null') INTO v_actual FROM betk.inquiries WHERE id = v_iq_declined;
  v_actual := v_m2 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'send_declined', 'expected', 'BETK_QUOTE_DECLINED|null',
    'actual', v_actual, 'pass', v_actual = 'BETK_QUOTE_DECLINED|null'
  ));

  -- 37. resubmit_seller_application clears rejected_reason and moves submitted_at.
  PERFORM set_config('request.jwt.claim.sub', v_applicant::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_applicant, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE 'SELECT betk.resubmit_seller_application(''ci/p10-front'', ''ci/p10-back'')';
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_m1 <> 'ok' THEN
    v_actual := v_m1;
  ELSE
    SELECT CASE
      WHEN rejected_reason IS NULL
       AND submitted_at > timestamptz '2020-01-01 00:00:00+00'
      THEN 'cleared'
      ELSE coalesce(rejected_reason, 'null')
    END
    INTO v_actual
    FROM betk.seller_profiles
    WHERE id = v_applicant;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'resubmit_rejected', 'expected', 'cleared',
    'actual', v_actual, 'pass', v_actual = 'cleared'
  ));

  -- 38-39. Admin approve sets status and approved_at. Admin reject sets rejected_reason.
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'UPDATE betk.seller_profiles
       SET status = %L::betk.seller_status, approved_at = timestamptz %L
       WHERE id = %L',
      'active', '2026-06-01 00:00:00+00', v_approve
    );
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  BEGIN
    EXECUTE format(
      'UPDATE betk.seller_profiles SET rejected_reason = %L WHERE id = %L',
      'ci-reject', v_reject
    );
    v_m2 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m2 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF v_m1 <> 'ok' THEN
    v_actual := v_m1;
  ELSE
    SELECT status::text || '|' || to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    INTO v_actual
    FROM betk.seller_profiles
    WHERE id = v_approve;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'admin_approve', 'expected', 'active|2026-06-01 00:00:00',
    'actual', v_actual, 'pass', v_actual = 'active|2026-06-01 00:00:00'
  ));
  IF v_m2 <> 'ok' THEN
    v_actual := v_m2;
  ELSE
    SELECT coalesce(rejected_reason, 'null') INTO v_actual
    FROM betk.seller_profiles WHERE id = v_reject;
  END IF;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'admin_reject', 'expected', 'ci-reject',
    'actual', v_actual, 'pass', v_actual = 'ci-reject'
  ));

  -- 40. A seller UPDATE of a column outside the re-grant is refused.
  PERFORM set_config('request.jwt.claim.sub', v_seller::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_seller, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format(
      'UPDATE betk.seller_profiles SET level = %L::betk.seller_level WHERE id = %L',
      'silver', v_seller
    );
    v_m1 := '00000';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT level::text INTO v_actual FROM betk.seller_profiles WHERE id = v_seller;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'seller_other_column_refused', 'expected', '42501|bronze',
    'actual', v_actual, 'pass', v_actual = '42501|bronze'
  ));

  -- 41. checkout_from_cart gets past the row lock. The rate lookup is after
  -- the lock, and this database has no courier rate, so the error is not a
  -- permission error. CI TEST VALUE: payment_window_minutes, this transaction
  -- only, never staging.
  UPDATE betk.admin_settings SET value = '30' WHERE key = 'payment_window_minutes';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_P10_FIXTURE_WINDOW';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role', 'authenticated')::text, true);
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    EXECUTE format('SELECT betk.checkout_from_cart(%L)', v_address);
    v_m1 := 'ok';
  EXCEPTION WHEN OTHERS THEN
    v_m1 := SQLERRM;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  SELECT CASE WHEN count(*) > 0 THEN 'kept' ELSE '0' END
  INTO v_actual
  FROM betk.cart_items
  WHERE buyer_id = v_buyer;
  v_actual := v_m1 || '|' || v_actual;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'checkout_row_lock', 'expected', 'BETK_CHECKOUT_RATE_MISSING|kept',
    'actual', v_actual, 'pass', v_actual = 'BETK_CHECKOUT_RATE_MISSING|kept'
  ));

  SELECT coalesce(bool_and((e->>'pass')::boolean), false), count(*)::integer
  INTO v_all, v_n
  FROM jsonb_array_elements(v_rows) AS e;
  v_actual := v_all::text || '|' || v_n::text;
  v_rows := v_rows || jsonb_build_array(jsonb_build_object(
    'name', 'all_pass', 'expected', 'true|41',
    'actual', v_actual, 'pass', v_actual = 'true|41'
  ));

  PERFORM set_config('p10.results', v_rows::text, true);
END;
$cases$;

SELECT r.name, r.expected, r.actual, r.pass
FROM jsonb_to_recordset(current_setting('p10.results')::jsonb)
  AS r(name text, expected text, actual text, pass boolean);

ROLLBACK;
