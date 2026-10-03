DO $rehearsal_guard$
BEGIN
  IF to_regclass('rehearsal.sentinel') IS NULL THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_SENTINEL_MISSING';
  END IF;
END
$rehearsal_guard$;

BEGIN;
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
CREATE TEMP TABLE n27_bound (
  kind text NOT NULL,
  label text,
  id uuid,
  status text,
  row_md5 text,
  stock_qty integer,
  n integer
);

INSERT INTO n27_bound (kind, id, status) VALUES
  ('target', '60000000-0000-4000-8000-000000000001', 'pending'),
  ('target', '60000000-0000-4000-8000-000000000002', 'pending'),
  ('target', '60000000-0000-4000-8000-000000000003', 'pending'),
  ('target', '60000000-0000-4000-8000-000000000005', 'confirmed'),
  ('target', '60000000-0000-4000-8000-000000000007', 'confirmed');

INSERT INTO n27_bound (kind, id, status) VALUES
  ('keep', '60000000-0000-4000-8000-000000000004', 'cancelled'),
  ('keep', '60000000-0000-4000-8000-000000000006', 'cancelled');

INSERT INTO n27_bound (kind, id, row_md5)
SELECT 'history', b.id, b.row_md5
FROM rehearsal.baseline AS b
WHERE b.kind = 'history'
  AND b.id IN (
    '70000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000007'
  );

INSERT INTO n27_bound (kind, id, stock_qty)
SELECT 'listing', b.id, b.stock_qty
FROM rehearsal.baseline AS b
WHERE b.kind = 'listing'
  AND b.id IN (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003'
  );

INSERT INTO n27_bound (kind, label, n) VALUES
  ('count', 'orders', 7),
  ('count', 'payments', 0),
  ('count', 'items', 0),
  ('count', 'history', 7);
-- <<< STAGING-BOUND LITERALS

-- M5 v2_08_n27_masters. Plan §4.3, §4.6, §4.9, §6 M5.
-- The link updates only master_order_id while trg_enforce_order_transition
-- is still enabled. D1 disables that one trigger around the five updates
-- and five history inserts. Not DISABLE TRIGGER ALL. Not session_replication_role.

DO $n27$
DECLARE
  v_payments integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'payments');
  v_orders integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'orders');
  v_items integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'items');
BEGIN
  IF (SELECT count(*) FROM betk.payments) <> v_payments THEN
    RAISE EXCEPTION 'BETK_N27_PAYMENTS_NONEMPTY';
  END IF;
  IF (SELECT count(*) FROM betk.orders) <> v_orders THEN
    RAISE EXCEPTION 'BETK_N27_ORDER_COUNT';
  END IF;
  IF (SELECT count(*) FROM betk.order_items) <> v_items THEN
    RAISE EXCEPTION 'BETK_N27_ITEMS_NONEMPTY';
  END IF;
  IF (
    SELECT count(*)
    FROM n27_bound AS b
    JOIN betk.orders AS o ON o.id = b.id
    WHERE b.kind = 'target'
      AND o.status::text = b.status
  ) <> 5 THEN
    RAISE EXCEPTION 'BETK_N27_TARGET_STATUS';
  END IF;
END
$n27$;

INSERT INTO betk.master_orders (
  buyer_id,
  delivery_address_id,
  betk_ref,
  combined_delivery_total,
  created_at,
  recipient_name,
  recipient_phone,
  snapshot_governorate,
  snapshot_city,
  snapshot_street_address,
  snapshot_building_notes,
  proof_path,
  transfer_reference,
  proof_uploaded_at,
  payment_deadline
)
SELECT
  o.buyer_id,
  o.delivery_address_id,
  o.betk_ref,
  o.delivery_fee,
  o.created_at,
  NULL,
  NULL,
  a.governorate,
  a.city,
  a.street_address,
  a.building_notes,
  NULL,
  NULL,
  NULL,
  NULL
FROM betk.orders AS o
LEFT JOIN betk.addresses AS a ON a.id = o.delivery_address_id;

UPDATE betk.orders AS o
SET master_order_id = m.id
FROM betk.master_orders AS m
WHERE m.betk_ref = o.betk_ref;

ALTER TABLE betk.orders DISABLE TRIGGER trg_enforce_order_transition;

UPDATE betk.orders AS o
SET status = 'cancelled',
    cancelled_by = 'system'
FROM n27_bound AS b
WHERE b.kind = 'target'
  AND o.id = b.id;

INSERT INTO betk.order_status_history (
  order_id,
  from_status,
  to_status,
  changed_by,
  changed_by_type,
  notes
)
SELECT
  b.id,
  b.status::betk.order_status,
  'cancelled',
  NULL,
  'system',
  'N27: cancelled; zero items and zero payments'
FROM n27_bound AS b
WHERE b.kind = 'target';

ALTER TABLE betk.orders ENABLE TRIGGER trg_enforce_order_transition;

DO $n27_verify$
DECLARE
  v_payments integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'payments');
  v_items integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'items');
  v_history integer := (SELECT n FROM n27_bound WHERE kind = 'count' AND label = 'history');
BEGIN
  IF (
    SELECT t.tgenabled
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'betk'
      AND c.relname = 'orders'
      AND t.tgname = 'trg_enforce_order_transition'
  ) <> 'O' THEN
    RAISE EXCEPTION 'BETK_N27_TRIGGER_NOT_ENABLED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    JOIN betk.order_status_history AS h ON h.id = b.id
    WHERE b.kind = 'history'
      AND md5(
        h.id::text || '|' || COALESCE(h.from_status::text, '') || '|' || h.to_status::text
        || '|' || COALESCE(h.changed_by::text, '') || '|' || COALESCE(h.changed_by_type::text, '')
        || '|' || COALESCE(h.notes, '') || '|' || h.created_at::text
      ) IS DISTINCT FROM b.row_md5
  ) THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_MD5';
  END IF;

  IF (SELECT count(*) FROM betk.order_status_history) <> v_history + 5 THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_COUNT';
  END IF;

  IF (
    SELECT count(*)
    FROM betk.order_status_history AS h
    WHERE NOT EXISTS (
      SELECT 1
      FROM n27_bound AS b
      WHERE b.kind = 'history'
        AND b.id = h.id
    )
  ) <> 5 THEN
    RAISE EXCEPTION 'BETK_N27_HISTORY_NEW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    WHERE b.kind = 'target'
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = b.id
          AND h.to_status = 'cancelled'
          AND h.changed_by IS NULL
          AND h.changed_by_type = 'system'
          AND h.notes = 'N27: cancelled; zero items and zero payments'
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'BETK_N27_D1_ROW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    WHERE b.kind = 'keep'
      AND (
        SELECT count(*)
        FROM betk.order_status_history AS h
        WHERE h.order_id = b.id
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'BETK_N27_KEEP_HISTORY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM n27_bound AS b
    JOIN betk.listings AS l ON l.id = b.id
    WHERE b.kind = 'listing'
      AND l.stock_qty IS DISTINCT FROM b.stock_qty
  ) THEN
    RAISE EXCEPTION 'BETK_N27_STOCK_MOVED';
  END IF;

  IF (SELECT count(*) FROM betk.payments) <> v_payments THEN
    RAISE EXCEPTION 'BETK_N27_PAYMENTS_NONEMPTY';
  END IF;
  IF (SELECT count(*) FROM betk.order_items) <> v_items THEN
    RAISE EXCEPTION 'BETK_N27_ITEMS_NONEMPTY';
  END IF;
END
$n27_verify$;

ALTER TABLE betk.orders ALTER COLUMN master_order_id SET NOT NULL;
ALTER TABLE betk.orders ALTER COLUMN betk_ref DROP NOT NULL;
COMMIT;
