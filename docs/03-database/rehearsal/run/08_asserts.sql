DO $rehearsal_guard$
BEGIN
  IF to_regclass('rehearsal.sentinel') IS NULL THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_SENTINEL_MISSING';
  END IF;
END
$rehearsal_guard$;

BEGIN;

CREATE TEMP TABLE rehearsal_assert (
  ord integer PRIMARY KEY,
  name text NOT NULL,
  expected text,
  actual text,
  pass boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
SELECT 1, 'children', '7',
  (SELECT count(*)::text FROM betk.seller_orders),
  (SELECT count(*) = 7 FROM betk.seller_orders)
UNION ALL
SELECT 2, 'masters', '7',
  (SELECT count(*)::text FROM betk.master_orders),
  (SELECT count(*) = 7 FROM betk.master_orders)
UNION ALL
SELECT 3, 'history', '12',
  (SELECT count(*)::text FROM betk.order_status_history),
  (SELECT count(*) = 12 FROM betk.order_status_history)
UNION ALL
SELECT 4, 'payments', '0',
  (SELECT count(*)::text FROM betk.payments),
  (SELECT count(*) = 0 FROM betk.payments)
UNION ALL
SELECT 5, 'items', '0',
  (SELECT count(*)::text FROM betk.order_items),
  (SELECT count(*) = 0 FROM betk.order_items)
UNION ALL
SELECT 6, 'null_master_order_id', '0',
  (SELECT count(*)::text FROM betk.seller_orders WHERE master_order_id IS NULL),
  (SELECT count(*) = 0 FROM betk.seller_orders WHERE master_order_id IS NULL)
UNION ALL
SELECT 7, 'master_child_count_not_one', '0',
  (
    SELECT count(*)::text
    FROM (
      SELECT m.id
      FROM betk.master_orders AS m
      LEFT JOIN betk.seller_orders AS s ON s.master_order_id = m.id
      GROUP BY m.id
      HAVING count(s.id) <> 1
    ) AS bad
  ),
  (
    SELECT count(*) = 0
    FROM (
      SELECT m.id
      FROM betk.master_orders AS m
      LEFT JOIN betk.seller_orders AS s ON s.master_order_id = m.id
      GROUP BY m.id
      HAVING count(s.id) <> 1
    ) AS bad
  )
UNION ALL
SELECT 8, 'master_without_child', '0',
  (
    SELECT count(*)::text
    FROM betk.master_orders AS m
    WHERE NOT EXISTS (
      SELECT 1 FROM betk.seller_orders AS s WHERE s.master_order_id = m.id
    )
  ),
  (
    SELECT count(*) = 0
    FROM betk.master_orders AS m
    WHERE NOT EXISTS (
      SELECT 1 FROM betk.seller_orders AS s WHERE s.master_order_id = m.id
    )
  )
UNION ALL
SELECT 9, 'money_sums',
  b.subtotal::text || '|' || b.delivery_fee::text || '|' || b.total_amount::text || '|' || b.commission_amount::text,
  s.subtotal::text || '|' || s.delivery_fee::text || '|' || s.total_amount::text || '|' || s.commission_amount::text,
  s.subtotal IS NOT DISTINCT FROM b.subtotal
    AND s.delivery_fee IS NOT DISTINCT FROM b.delivery_fee
    AND s.total_amount IS NOT DISTINCT FROM b.total_amount
    AND s.commission_amount IS NOT DISTINCT FROM b.commission_amount
FROM rehearsal.baseline AS b
CROSS JOIN (
  SELECT
    sum(subtotal) AS subtotal,
    sum(delivery_fee) AS delivery_fee,
    sum(total_amount) AS total_amount,
    sum(commission_amount) AS commission_amount
  FROM betk.seller_orders
) AS s
WHERE b.kind = 'money'
UNION ALL
SELECT 10, 'combined_delivery_mismatch', '0',
  (
    SELECT count(*)::text
    FROM betk.master_orders AS m
    JOIN betk.seller_orders AS s ON s.master_order_id = m.id
    WHERE m.combined_delivery_total IS DISTINCT FROM s.delivery_fee
  ),
  (
    SELECT count(*) = 0
    FROM betk.master_orders AS m
    JOIN betk.seller_orders AS s ON s.master_order_id = m.id
    WHERE m.combined_delivery_total IS DISTINCT FROM s.delivery_fee
  )
UNION ALL
SELECT 11, 'identity_mismatch', '0',
  (
    SELECT count(*)::text
    FROM betk.master_orders AS m
    JOIN betk.seller_orders AS s ON s.master_order_id = m.id
    WHERE m.buyer_id IS DISTINCT FROM s.buyer_id
       OR m.delivery_address_id IS DISTINCT FROM s.delivery_address_id
       OR m.betk_ref IS DISTINCT FROM s.betk_ref
  ),
  (
    SELECT count(*) = 0
    FROM betk.master_orders AS m
    JOIN betk.seller_orders AS s ON s.master_order_id = m.id
    WHERE m.buyer_id IS DISTINCT FROM s.buyer_id
       OR m.delivery_address_id IS DISTINCT FROM s.delivery_address_id
       OR m.betk_ref IS DISTINCT FROM s.betk_ref
  )
UNION ALL
SELECT 12, 'status_cancelled', '7',
  (SELECT count(*)::text FROM betk.seller_orders WHERE status = 'cancelled'),
  (SELECT count(*) = 7 FROM betk.seller_orders WHERE status = 'cancelled')
UNION ALL
SELECT 13, 'stock_matches_baseline', 'true',
  (
    SELECT bool_and(l.stock_qty IS NOT DISTINCT FROM b.stock_qty)::text
    FROM rehearsal.baseline AS b
    JOIN betk.listings AS l ON l.id = b.id
    WHERE b.kind = 'listing'
  ),
  (
    SELECT bool_and(l.stock_qty IS NOT DISTINCT FROM b.stock_qty)
      AND count(*) = 3
    FROM rehearsal.baseline AS b
    JOIN betk.listings AS l ON l.id = b.id
    WHERE b.kind = 'listing'
  )
UNION ALL
SELECT 14, 'original_history_md5', 'true',
  (
    SELECT (count(*) = 7 AND bool_and(
      md5(
        h.id::text || '|' || COALESCE(h.from_status::text, '') || '|' || h.to_status::text
        || '|' || COALESCE(h.changed_by::text, '') || '|' || COALESCE(h.changed_by_type::text, '')
        || '|' || COALESCE(h.notes, '') || '|' || h.created_at::text
      ) IS NOT DISTINCT FROM b.row_md5
    ))::text
    FROM rehearsal.baseline AS b
    JOIN betk.order_status_history AS h ON h.id = b.id
    WHERE b.kind = 'history'
  ),
  (
    SELECT count(*) = 7 AND bool_and(
      md5(
        h.id::text || '|' || COALESCE(h.from_status::text, '') || '|' || h.to_status::text
        || '|' || COALESCE(h.changed_by::text, '') || '|' || COALESCE(h.changed_by_type::text, '')
        || '|' || COALESCE(h.notes, '') || '|' || h.created_at::text
      ) IS NOT DISTINCT FROM b.row_md5
    )
    FROM rehearsal.baseline AS b
    JOIN betk.order_status_history AS h ON h.id = b.id
    WHERE b.kind = 'history'
  )
UNION ALL
SELECT 15, 'new_history_rows', '5',
  (
    SELECT count(*)::text
    FROM betk.order_status_history AS h
    WHERE NOT EXISTS (
      SELECT 1 FROM rehearsal.baseline AS b
      WHERE b.kind = 'history' AND b.id = h.id
    )
  ),
  (
    SELECT count(*) = 5
    FROM betk.order_status_history AS h
    WHERE NOT EXISTS (
      SELECT 1 FROM rehearsal.baseline AS b
      WHERE b.kind = 'history' AND b.id = h.id
    )
  )
UNION ALL
SELECT 16, 'd1_row_per_target', '5',
  (
    SELECT count(*)::text
    FROM betk.seller_orders AS o
    WHERE o.id IN (
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = o.id
          AND h.to_status = 'cancelled'
          AND h.changed_by IS NULL
          AND h.changed_by_type = 'system'
          AND h.notes = 'N27: cancelled; zero items and zero payments'
      ) = 1
  ),
  (
    SELECT count(*) = 5
    FROM betk.seller_orders AS o
    WHERE o.id IN (
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = o.id
          AND h.to_status = 'cancelled'
          AND h.changed_by IS NULL
          AND h.changed_by_type = 'system'
          AND h.notes = 'N27: cancelled; zero items and zero payments'
      ) = 1
  )
UNION ALL
SELECT 17, 'keep_history_one', '2',
  (
    SELECT count(*)::text
    FROM betk.seller_orders AS o
    WHERE o.id IN (
      '60000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000006'
    )
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = o.id
      ) = 1
  ),
  (
    SELECT count(*) = 2
    FROM betk.seller_orders AS o
    WHERE o.id IN (
      '60000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000006'
    )
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = o.id
      ) = 1
  )
UNION ALL
SELECT 18, 'targets_cancelled_by_system', '5',
  (
    SELECT count(*)::text
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND status = 'cancelled'
      AND cancelled_by = 'system'
  ),
  (
    SELECT count(*) = 5
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003',
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND status = 'cancelled'
      AND cancelled_by = 'system'
  )
UNION ALL
SELECT 19, 'keeps_cancelled_by_buyer', '2',
  (
    SELECT count(*)::text
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000006'
    )
      AND status = 'cancelled'
      AND cancelled_by = 'buyer'
  ),
  (
    SELECT count(*) = 2
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000006'
    )
      AND status = 'cancelled'
      AND cancelled_by = 'buyer'
  )
UNION ALL
SELECT 20, 'confirmed_at_kept', '2',
  (
    SELECT count(*)::text
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND confirmed_at IS NOT NULL
  ),
  (
    SELECT count(*) = 2
    FROM betk.seller_orders
    WHERE id IN (
      '60000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000007'
    )
      AND confirmed_at IS NOT NULL
  )
UNION ALL
SELECT 21, 'transition_trigger_enabled', 'O',
  (
    SELECT t.tgenabled::text
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'seller_orders'
      AND t.tgname = 'trg_enforce_order_transition'
  ),
  (
    SELECT t.tgenabled = 'O'
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'seller_orders'
      AND t.tgname = 'trg_enforce_order_transition'
  )
UNION ALL
SELECT 22, 'inquiries_converted_null', '3',
  (SELECT count(*)::text FROM betk.inquiries WHERE converted_to_order_id IS NULL),
  (SELECT count(*) = 3 FROM betk.inquiries WHERE converted_to_order_id IS NULL)
UNION ALL
SELECT 23, 'orders_with_inquiry', '3',
  (SELECT count(*)::text FROM betk.seller_orders WHERE inquiry_id IS NOT NULL),
  (SELECT count(*) = 3 FROM betk.seller_orders WHERE inquiry_id IS NOT NULL)
UNION ALL
SELECT 24, 'addresses', '2',
  (SELECT count(*)::text FROM betk.addresses),
  (SELECT count(*) = 2 FROM betk.addresses)
UNION ALL
SELECT 25, 'stores', '2',
  (SELECT count(*)::text FROM betk.stores),
  (SELECT count(*) = 2 FROM betk.stores)
UNION ALL
SELECT 26, 'listings_null_stock', '2',
  (SELECT count(*)::text FROM betk.listings WHERE stock_qty IS NULL),
  (SELECT count(*) = 2 FROM betk.listings WHERE stock_qty IS NULL)
UNION ALL
SELECT 27, 'listings_nonnull_stock', '1',
  (SELECT count(*)::text FROM betk.listings WHERE stock_qty IS NOT NULL),
  (SELECT count(*) = 1 FROM betk.listings WHERE stock_qty IS NOT NULL)
UNION ALL
SELECT 28, 'ref_betk_shape', '>=1',
  (
    SELECT count(*)::text
    FROM betk.seller_orders
    WHERE betk_ref ~ '^BETK-[0-9]{8}-[A-Z0-9]{4}$'
  ),
  (
    SELECT count(*) >= 1
    FROM betk.seller_orders
    WHERE betk_ref ~ '^BETK-[0-9]{8}-[A-Z0-9]{4}$'
  )
UNION ALL
SELECT 29, 'ref_p7t02b_shape', '>=1',
  (
    SELECT count(*)::text
    FROM betk.seller_orders
    WHERE betk_ref LIKE 'P7T02B-%'
  ),
  (
    SELECT count(*) >= 1
    FROM betk.seller_orders
    WHERE betk_ref LIKE 'P7T02B-%'
  )
UNION ALL
SELECT 30, 'refs_unique_le_25', '7',
  (
    SELECT count(DISTINCT betk_ref)::text
    FROM betk.seller_orders
    WHERE betk_ref IS NOT NULL
      AND char_length(betk_ref) <= 25
  ),
  (
    SELECT count(DISTINCT betk_ref) = 7
      AND count(*) FILTER (WHERE betk_ref IS NOT NULL AND char_length(betk_ref) > 25) = 0
      AND count(*) FILTER (WHERE betk_ref IS NOT NULL) = 7
    FROM betk.seller_orders
  );

DO $rehearsal_delete$
BEGIN
  DELETE FROM betk.seller_orders
  WHERE id = '60000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'BETK_REHEARSAL_DELETE_TOOK_EFFECT';
EXCEPTION
  WHEN foreign_key_violation THEN
    INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
    VALUES (31, 'delete_history_bearing_order', 'foreign_key_violation', SQLSTATE, true);
END
$rehearsal_delete$;

-- Plan §6 M6 verify. Rename keeps the history FK's relation OID, so
-- confrelid = seller_orders and confdeltype 'a' (NO ACTION) is that proof.
INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
SELECT 32, 'm6_to_regclass', 'orders_null|seller_orders_present',
  CASE WHEN to_regclass('betk.orders') IS NULL THEN 'orders_null' ELSE 'orders_present' END
    || '|' ||
  CASE WHEN to_regclass('betk.seller_orders') IS NOT NULL THEN 'seller_orders_present' ELSE 'seller_orders_absent' END,
  to_regclass('betk.orders') IS NULL
    AND to_regclass('betk.seller_orders') IS NOT NULL
UNION ALL
SELECT 33, 'create_order_from_inquiry_absent', 'null',
  COALESCE(
    to_regprocedure('betk.create_order_from_inquiry(uuid,uuid,betk.delivery_preference,betk.payment_method)')::text,
    'null'
  ),
  to_regprocedure('betk.create_order_from_inquiry(uuid,uuid,betk.delivery_preference,betk.payment_method)') IS NULL
UNION ALL
SELECT 34, 'no_betk_orders_in_defs', 'absent',
  CASE
    WHEN strpos(pg_get_functiondef('betk.enforce_payment_update()'::regprocedure), 'betk.orders') = 0
     AND strpos(pg_get_functiondef('betk.checkout_from_cart(uuid)'::regprocedure), 'betk.orders') = 0
    THEN 'absent'
    ELSE 'present'
  END,
  strpos(pg_get_functiondef('betk.enforce_payment_update()'::regprocedure), 'betk.orders') = 0
    AND strpos(pg_get_functiondef('betk.checkout_from_cart(uuid)'::regprocedure), 'betk.orders') = 0
UNION ALL
SELECT 35, 'checkout_execute_revoked', 'false|false',
  has_function_privilege('anon', 'betk.checkout_from_cart(uuid)', 'EXECUTE')::text
    || '|' ||
  has_function_privilege('authenticated', 'betk.checkout_from_cart(uuid)', 'EXECUTE')::text,
  NOT has_function_privilege('anon', 'betk.checkout_from_cart(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'betk.checkout_from_cart(uuid)', 'EXECUTE')
UNION ALL
SELECT 36, 'daily_platform_snapshot_command', 'seller_orders|5 22 * * *',
  COALESCE((
    SELECT CASE
      WHEN strpos(j.command, 'betk.orders') = 0 AND strpos(j.command, 'betk.seller_orders') > 0
      THEN 'seller_orders'
      ELSE 'orders_still_named'
    END || '|' || j.schedule
    FROM cron.job AS j
    WHERE j.jobname = 'daily-platform-snapshot'
  ), 'missing'),
  COALESCE((
    SELECT strpos(j.command, 'betk.orders') = 0
      AND strpos(j.command, 'betk.seller_orders') > 0
      AND j.schedule = '5 22 * * *'
    FROM cron.job AS j
    WHERE j.jobname = 'daily-platform-snapshot'
  ), false)
UNION ALL
SELECT 37, 'history_fk_same_oid_no_action', 'same_oid|a',
  COALESCE((
    SELECT CASE WHEN c.confrelid = 'betk.seller_orders'::regclass THEN 'same_oid' ELSE 'other_oid' END
      || '|' || c.confdeltype::text
    FROM pg_constraint AS c
    WHERE c.conname = 'order_status_history_order_id_fkey'
  ), 'missing'),
  COALESCE((
    SELECT c.confrelid = 'betk.seller_orders'::regclass
      AND c.confdeltype = 'a'
    FROM pg_constraint AS c
    WHERE c.conname = 'order_status_history_order_id_fkey'
  ), false)
UNION ALL
SELECT 38, 'four_rules_instead_nothing', '4',
  count(*)::text,
  count(*) = 4
FROM pg_rules
WHERE schemaname = 'betk'
  AND rulename IN (
    'no_delete_mod_log',
    'no_update_mod_log',
    'no_delete_order_history',
    'no_update_order_history'
  )
  AND definition LIKE '%DO INSTEAD NOTHING%';

DO $rehearsal_checkout$
BEGIN
  PERFORM betk.checkout_from_cart('00000000-0000-0000-0000-000000000000'::uuid);
  INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
  VALUES (39, 'checkout_from_cart_not_ready', 'BETK_CHECKOUT_NOT_READY', 'no_exception', false);
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
    VALUES (
      39,
      'checkout_from_cart_not_ready',
      'BETK_CHECKOUT_NOT_READY',
      SQLERRM,
      SQLERRM = 'BETK_CHECKOUT_NOT_READY'
    );
END
$rehearsal_checkout$;

INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
SELECT 40, 'master_orders_anon_select', 'false',
  has_table_privilege('anon', 'betk.master_orders', 'SELECT')::text,
  has_table_privilege('anon', 'betk.master_orders', 'SELECT') = false
UNION ALL
SELECT 41, 'master_orders_authenticated_update', 'false',
  has_table_privilege('authenticated', 'betk.master_orders', 'UPDATE')::text,
  has_table_privilege('authenticated', 'betk.master_orders', 'UPDATE') = false
UNION ALL
SELECT 42, 'master_orders_authenticated_insert', 'false',
  has_table_privilege('authenticated', 'betk.master_orders', 'INSERT')::text,
  has_table_privilege('authenticated', 'betk.master_orders', 'INSERT') = false
UNION ALL
SELECT 43, 'returns_update_qual', 'betk.is_admin()',
  COALESCE((
    SELECT pg_get_expr(p.polqual, p.polrelid)
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'returns'
      AND p.polname = 'returns_update'
  ), 'missing'),
  COALESCE((
    SELECT pg_get_expr(p.polqual, p.polrelid) = 'betk.is_admin()'
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'returns'
      AND p.polname = 'returns_update'
  ), false)
UNION ALL
SELECT 44, 'store_categories_select_approved', 'contains',
  COALESCE((
    SELECT pg_get_expr(p.polqual, p.polrelid)
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'store_categories'
      AND p.polname = 'store_categories_select'
  ), 'missing'),
  COALESCE((
    SELECT strpos(pg_get_expr(p.polqual, p.polrelid), 'approved_at IS NOT NULL') > 0
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'store_categories'
      AND p.polname = 'store_categories_select'
  ), false);

INSERT INTO rehearsal_assert (ord, name, expected, actual, pass)
SELECT 45, 'all_pass', 'true|44',
  bool_and(pass)::text || '|' || count(*)::text,
  bool_and(pass) AND count(*) = 44
FROM rehearsal_assert;

SELECT name, expected, actual, pass
FROM rehearsal_assert
ORDER BY ord;

COMMIT;
