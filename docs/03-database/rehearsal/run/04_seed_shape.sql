DO $rehearsal_guard$
BEGIN
  IF to_regclass('rehearsal.sentinel') IS NULL THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_SENTINEL_MISSING';
  END IF;
END
$rehearsal_guard$;

BEGIN;

-- Plan §7.2 shape. Fixed ids, never the staging ids.
-- Parents, cited from live pg_constraint (2026-09-26, SELECT only):
--   seller_profiles_id_fkey            seller_profiles.id -> users.id
--   stores_seller_id_fkey              stores.seller_id -> seller_profiles.id
--   addresses_buyer_id_fkey            addresses.buyer_id -> users.id
--   listings_store_id_fkey             listings.store_id -> stores.id
--   listings_category_id_fkey          listings.category_id -> categories.id
--   inquiries_buyer_id_fkey            inquiries.buyer_id -> users.id
--   inquiries_store_id_fkey            inquiries.store_id -> stores.id
--   inquiries_listing_id_fkey          inquiries.listing_id -> listings.id
--   orders_buyer_id_fkey               orders.buyer_id -> users.id
--   orders_store_id_fkey               orders.store_id -> stores.id
--   orders_delivery_address_id_fkey    orders.delivery_address_id -> addresses.id
--   orders_inquiry_id_fkey             orders.inquiry_id -> inquiries.id
--   order_status_history_order_id_fkey order_status_history.order_id -> orders.id
--   order_status_history_changed_by_fkey order_status_history.changed_by -> users.id
-- betk.users has no foreign key to auth.users. No auth row is created.
-- trg_enforce_order_transition is BEFORE UPDATE only (pg_get_triggerdef,
-- 2026-09-26). Inserting confirmed and cancelled does not fire it.
-- trg_set_inquiry_converted_order is AFTER INSERT WHEN inquiry_id IS NOT
-- NULL, so orders are inserted with inquiry_id NULL and then updated.
-- That update does not change status or cancel metadata, so the transition
-- function returns NEW. No trigger is disabled. No rule is rewritten.

INSERT INTO betk.users (id, role, status) VALUES
  ('10000000-0000-4000-8000-000000000001', 'buyer', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'buyer', 'active'),
  ('10000000-0000-4000-8000-000000000003', 'seller', 'active'),
  ('10000000-0000-4000-8000-000000000004', 'seller', 'active');

INSERT INTO betk.seller_profiles (id, status) VALUES
  ('10000000-0000-4000-8000-000000000003', 'active'),
  ('10000000-0000-4000-8000-000000000004', 'active');

INSERT INTO betk.stores (
  id, seller_id, name_ar, slug, governorate, city, category_primary, status
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'Rehearsal Store A',
    'rehearsal-store-a',
    'Rehearsal',
    'Rehearsal City',
    'rehearsal',
    'active'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000004',
    'Rehearsal Store B',
    'rehearsal-store-b',
    'Rehearsal',
    'Rehearsal City',
    'rehearsal',
    'active'
  );

DO $rehearsal_category$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM betk.categories
    WHERE parent_id IS NULL
      AND is_active
  ) THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_NO_CATEGORY';
  END IF;
END
$rehearsal_category$;

INSERT INTO betk.listings (
  id, store_id, category_id, title_ar, type, price_type, price, stock_qty, status
)
SELECT
  v.id,
  v.store_id,
  c.id,
  v.title_ar,
  'product',
  'fixed',
  100,
  v.stock_qty,
  'draft'
FROM (
  VALUES
    ('30000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'Rehearsal listing A', NULL::integer),
    ('30000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'Rehearsal listing B', NULL::integer),
    ('30000000-0000-4000-8000-000000000003'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'Rehearsal listing C', 50)
) AS v(id, store_id, title_ar, stock_qty)
CROSS JOIN LATERAL (
  SELECT id
  FROM betk.categories
  WHERE parent_id IS NULL
    AND is_active
  ORDER BY slug
  LIMIT 1
) AS c;

INSERT INTO betk.addresses (
  id, buyer_id, governorate, city, street_address
) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Rehearsal',
    'Rehearsal City',
    'Rehearsal Street 1'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Rehearsal',
    'Rehearsal City',
    'Rehearsal Street 2'
  );

INSERT INTO betk.inquiries (
  id, buyer_id, store_id, listing_id, quantity, buyer_first_message, status
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'rehearsal',
    'confirmed'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'rehearsal',
    'confirmed'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    1,
    'rehearsal',
    'confirmed'
  );

INSERT INTO betk.orders (
  id, buyer_id, store_id, delivery_address_id, delivery_method,
  subtotal, delivery_fee, total_amount, status, betk_ref,
  cancelled_by, confirmed_at, created_at
) VALUES
  (
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'delivery', 100, 0, 100, 'pending', 'BETK-20260926-A001',
    NULL, NULL, '2026-09-26 12:00:01+00'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'delivery', 100, 0, 100, 'pending', 'BETK-20260926-A002',
    NULL, NULL, '2026-09-26 12:00:02+00'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'delivery', 100, 0, 100, 'pending', 'BETK-20260926-A003',
    NULL, NULL, '2026-09-26 12:00:03+00'
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    NULL,
    'delivery', 200, 0, 200, 'cancelled', 'P7T02B-rh000001-L',
    'buyer', NULL, '2026-09-26 12:00:04+00'
  ),
  (
    '60000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    NULL,
    'delivery', 200, 0, 200, 'confirmed', 'P7T02B-rh000001-M',
    NULL, '2026-09-26 12:00:05+00', '2026-09-26 12:00:05+00'
  ),
  (
    '60000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    NULL,
    'delivery', 200, 0, 200, 'cancelled', 'P7T02B-rh000002-L',
    'buyer', NULL, '2026-09-26 12:00:06+00'
  ),
  (
    '60000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    NULL,
    'delivery', 200, 0, 200, 'confirmed', 'P7T02B-rh000002-M',
    NULL, '2026-09-26 12:00:07+00', '2026-09-26 12:00:07+00'
  );

UPDATE betk.orders
SET inquiry_id = '50000000-0000-4000-8000-000000000001'
WHERE id = '60000000-0000-4000-8000-000000000001';

UPDATE betk.orders
SET inquiry_id = '50000000-0000-4000-8000-000000000002'
WHERE id = '60000000-0000-4000-8000-000000000002';

UPDATE betk.orders
SET inquiry_id = '50000000-0000-4000-8000-000000000003'
WHERE id = '60000000-0000-4000-8000-000000000003';

DO $rehearsal_link$
BEGIN
  IF (SELECT count(*) FROM betk.inquiries WHERE converted_to_order_id IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_CONVERSION_WRITTEN';
  END IF;
  IF (SELECT count(*) FROM betk.orders WHERE inquiry_id IS NOT NULL) <> 3 THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_INQUIRY_LINK';
  END IF;
END
$rehearsal_link$;

INSERT INTO betk.order_status_history (
  id, order_id, from_status, to_status, changed_by, changed_by_type, notes, created_at
) VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    NULL, 'pending',
    '10000000-0000-4000-8000-000000000001', 'buyer',
    'order created', '2026-09-26 12:01:01+00'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    NULL, 'pending',
    '10000000-0000-4000-8000-000000000001', 'buyer',
    'order created', '2026-09-26 12:01:02+00'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000003',
    NULL, 'pending',
    '10000000-0000-4000-8000-000000000002', 'buyer',
    'order created', '2026-09-26 12:01:03+00'
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000004',
    'pending', 'cancelled',
    '10000000-0000-4000-8000-000000000001', 'buyer',
    'order cancelled by buyer', '2026-09-26 12:01:04+00'
  ),
  (
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000005',
    'pending', 'confirmed',
    '10000000-0000-4000-8000-000000000003', 'seller',
    'order accepted by seller', '2026-09-26 12:01:05+00'
  ),
  (
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000006',
    'pending', 'cancelled',
    '10000000-0000-4000-8000-000000000002', 'buyer',
    'order cancelled by buyer', '2026-09-26 12:01:06+00'
  ),
  (
    '70000000-0000-4000-8000-000000000007',
    '60000000-0000-4000-8000-000000000007',
    'pending', 'confirmed',
    '10000000-0000-4000-8000-000000000004', 'seller',
    'order accepted by seller', '2026-09-26 12:01:07+00'
  );

CREATE TABLE rehearsal.baseline (
  kind text NOT NULL,
  id uuid,
  row_md5 text,
  stock_qty integer,
  subtotal numeric(12,2),
  delivery_fee numeric(12,2),
  total_amount numeric(12,2),
  commission_amount numeric(12,2)
);

INSERT INTO rehearsal.baseline (kind, id, row_md5)
SELECT
  'history',
  h.id,
  md5(
    h.id::text || '|' || COALESCE(h.from_status::text, '') || '|' || h.to_status::text
    || '|' || COALESCE(h.changed_by::text, '') || '|' || COALESCE(h.changed_by_type::text, '')
    || '|' || COALESCE(h.notes, '') || '|' || h.created_at::text
  )
FROM betk.order_status_history AS h;

INSERT INTO rehearsal.baseline (kind, subtotal, delivery_fee, total_amount, commission_amount)
SELECT
  'money',
  sum(subtotal),
  sum(delivery_fee),
  sum(total_amount),
  sum(commission_amount)
FROM betk.orders;

INSERT INTO rehearsal.baseline (kind, id, stock_qty)
SELECT 'listing', id, stock_qty
FROM betk.listings
WHERE id IN (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
);

SELECT kind, id, row_md5, stock_qty, subtotal, delivery_fee, total_amount, commission_amount
FROM rehearsal.baseline
ORDER BY kind, id;

COMMIT;
