-- M8 v2_08_functions. Plan §1.7 and §6 M8.
-- checkout_from_cart replaces the M6 shell (C1, CREATE OR REPLACE).
-- CF-3: ADR-023 on pickup writes and on stores.governorate updates.
-- CF-4: drop trg_set_inquiry_converted_order and set_inquiry_converted_order
-- last. The column and fk_inquiries_order stay. create_order_from_inquiry
-- is already gone (M6) and is not recreated.
--
-- FLAGS (spec does not decide these). G3, below, is the fail-closed rule.
-- FLAG-REG-88. Agreement keys are read and not branched. Plan §8.2.5:
-- if the pin includes the document, empty fails closed; if it excludes the
-- document, checkout does not consult the key. REG-88 is not pinned.
-- FLAG-SUBMIT. submit_seller_application / resubmit_seller_application are
-- not rewritten. D3 names category text as the source of store_categories
-- and does not pin the match to categories.id (name_ar, name_en, or slug).
-- FLAG-REFUND. D2 says the admin supplies the goods portion and the trigger
-- must not copy payments.refunded_amount. No second input column exists.
-- refunded_subtotal is not written.
-- G3 (human, 2026-10-02). The payout cap excludes a seller order that
-- has a dispute or a return whose status is not closed, resolved,
-- rejected, refunded, or cancelled. Live labels (SELECT 2026-10-02):
-- dispute_status submitted, under_review, awaiting_seller, resolved,
-- closed; return_status requested, accepted, rejected, refunded.
-- Terminal among those: dispute resolved and closed; return rejected
-- and refunded. accepted blocks. cancelled is in neither enum. Which
-- of those should block is a product pin (REG minted with this fix).
-- FLAG-COURIER. courier_rates has no courier-name column (ERD §6.1).
-- shipments.courier is set to the matched rate id text. courier_rate_id
-- stores the same id (ERD §6.2).
-- FLAG-PREDELIVERY. "pre-delivery" is not a list. Restore runs from
-- pending, confirmed, preparing, or ready. Not from dispatched.
-- FLAG-RETURN-ACTOR. ERD §7.1 says delivered → returned is "return
-- accepted" and does not name the role. The transition requires an
-- accepted returns row and is_admin().
-- FLAG-PREP-NULL. prep_deadline stays null when every item prep snapshot
-- is null. Zero days is not assumed.
-- FLAG-QUOTE-HOURS. Checkout refuses a custom line whose quote_expires_at
-- is null or not in the future. It does not re-read quote_validity_hours
-- (that key's consumer in §8.2.5 is quote send).
--
-- AUTHORED settings readers. checkout_from_cart is SECURITY INVOKER
-- (plan §1.7). payment_window_minutes, quote_tolerance_multiplier, and the
-- four agreement keys are admin-only (REG-69, plan §8.2.5), so an INVOKER
-- read sees no row. The three DEFINER functions below are the commission-
-- snapshot pattern (ERD §7 set_order_commission_snapshot): the INVOKER
-- body calls them, they read one pinned key, EXECUTE is granted to
-- authenticated and revoked from PUBLIC and anon.

CREATE OR REPLACE FUNCTION betk.checkout_payment_window_minutes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'payment_window_minutes';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_PAYMENT_WINDOW_UNCONFIGURED';
  END IF;
  RETURN btrim(v_raw)::integer;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_payment_window_minutes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_payment_window_minutes() TO authenticated;

CREATE OR REPLACE FUNCTION betk.checkout_quote_multiplier()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'quote_tolerance_multiplier';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[0-9]+(\.[0-9]+)?$' OR btrim(v_raw)::numeric <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_BAND_UNCONFIGURED';
  END IF;
  RETURN btrim(v_raw)::numeric;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_quote_multiplier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_quote_multiplier() TO authenticated;

CREATE OR REPLACE FUNCTION betk.checkout_agreement_version(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
BEGIN
  IF p_key NOT IN (
    'agreement_buyer_terms_version',
    'agreement_seller_agreement_version',
    'agreement_return_policy_version',
    'agreement_privacy_version'
  ) THEN
    RAISE EXCEPTION 'BETK_AGREEMENT_KEY_NOT_CHECKOUT';
  END IF;
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = p_key;
  RETURN v_raw;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.checkout_agreement_version(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.checkout_agreement_version(text) TO authenticated;

-- touch_stock. Plan §1.7. INVOKER. Stamps stock_touched_at when stock_qty
-- changes. Checkout does not set that column itself.
CREATE OR REPLACE FUNCTION betk.touch_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty THEN
    NEW.stock_touched_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.touch_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_touch_stock ON betk.listings;
CREATE TRIGGER trg_touch_stock
  BEFORE UPDATE OF stock_qty ON betk.listings
  FOR EACH ROW
  EXECUTE FUNCTION betk.touch_stock();

-- decrement_stock_on_confirm rework (plan §1.7, §7.2 / ERD §7.2).
-- The confirm trigger stays dropped (M4). This body runs from the
-- order_items INSERT trigger so the INVOKER checkout does not UPDATE
-- listings and does not need EXECUTE on this function (ADR-012 revoke
-- already applied; CREATE OR REPLACE keeps it).
CREATE OR REPLACE FUNCTION betk.decrement_stock_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_stock integer;
  v_status betk.listing_status;
BEGIN
  SELECT l.stock_qty, l.status
    INTO v_stock, v_status
  FROM betk.listings AS l
  WHERE l.id = NEW.listing_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_LISTING_MISSING';
  END IF;
  IF v_stock IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'BETK_CHECKOUT_OUT_OF_STOCK';
  END IF;
  UPDATE betk.listings
  SET stock_qty = v_stock - NEW.quantity,
      status = CASE
        WHEN v_stock - NEW.quantity = 0 AND v_status = 'active'
        THEN 'sold_out'::betk.listing_status
        ELSE v_status
      END,
      updated_at = now()
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_checkout ON betk.order_items;
CREATE TRIGGER trg_decrement_stock_on_checkout
  AFTER INSERT ON betk.order_items
  FOR EACH ROW
  EXECUTE FUNCTION betk.decrement_stock_on_confirm();

-- enforce_order_transition rework. ERD §7.1. is_admin() is an actor check
-- on the admin rows of that table, not a bypass of it. Seller is never
-- stamped as cancelled_by. buyer_id is not dropped.
CREATE OR REPLACE FUNCTION betk.enforce_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_proof text;
  v_deadline timestamptz;
  v_hold text;
  v_hold_hours integer;
BEGIN
  IF NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
     OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
    IF NEW.status IS DISTINCT FROM 'cancelled'::betk.order_status
       OR OLD.status = 'cancelled'::betk.order_status THEN
      RAISE EXCEPTION 'BETK_CANCEL_METADATA_FORBIDDEN';
    END IF;
  END IF;

  -- G1 (human, 2026-10-02). The three seller escalation columns, even
  -- when status is unchanged. escalation_resolved_at is absent from the
  -- authenticated UPDATE grant (M7), so a seller write of it is 42501.
  IF NEW.escalated_at IS DISTINCT FROM OLD.escalated_at
     OR NEW.escalation_reason IS DISTINCT FROM OLD.escalation_reason
     OR NEW.escalation_note IS DISTINCT FROM OLD.escalation_note THEN
    IF NEW.store_id IS DISTINCT FROM betk.my_store_id()
       AND NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ESCALATION_ACTOR';
    END IF;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT m.proof_path, m.payment_deadline
    INTO v_proof, v_deadline
  FROM betk.master_orders AS m
  WHERE m.id = OLD.master_order_id;

  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    IF auth.uid() IS NOT NULL AND OLD.buyer_id = auth.uid() THEN
      IF v_proof IS NOT NULL THEN
        RAISE EXCEPTION 'BETK_ORDER_CANCEL_AFTER_PROOF';
      END IF;
      NEW.cancelled_by := 'buyer';
    ELSIF auth.uid() IS NULL
          AND v_proof IS NULL
          AND v_deadline IS NOT NULL
          AND now() >= v_deadline THEN
      NEW.cancelled_by := 'system';
    ELSIF betk.is_admin() AND v_proof IS NOT NULL THEN
      NEW.cancelled_by := 'admin';
    ELSE
      RAISE EXCEPTION 'BETK_ORDER_CANCEL_FORBIDDEN';
    END IF;
  ELSIF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_RELEASE_ADMIN_ONLY';
    END IF;
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
  ELSIF OLD.status = 'confirmed' AND NEW.status = 'preparing' THEN
    IF OLD.store_id IS DISTINCT FROM betk.my_store_id() THEN
      RAISE EXCEPTION 'BETK_ORDER_PREPARING_STORE_ONLY';
    END IF;
  ELSIF OLD.status = 'preparing' AND NEW.status = 'ready' THEN
    IF OLD.store_id IS DISTINCT FROM betk.my_store_id() THEN
      RAISE EXCEPTION 'BETK_ORDER_READY_STORE_ONLY';
    END IF;
  ELSIF OLD.status = 'ready' AND NEW.status = 'dispatched' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_DISPATCH_ADMIN_ONLY';
    END IF;
  ELSIF OLD.status = 'dispatched' AND NEW.status = 'delivered' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_ORDER_DELIVER_ADMIN_ONLY';
    END IF;
    SELECT value INTO v_hold
    FROM betk.admin_settings
    WHERE key = 'return_hold_hours';
    IF v_hold IS NULL OR btrim(v_hold) !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'BETK_RETURN_HOLD_UNCONFIGURED';
    END IF;
    v_hold_hours := btrim(v_hold)::integer;
    NEW.delivered_at := now();
    NEW.payout_eligible_at := now() + make_interval(hours => v_hold_hours);
  ELSIF OLD.status IN ('confirmed', 'preparing') AND NEW.status = 'cancelled' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_NOT_CANCELLABLE';
    END IF;
    NEW.cancelled_by := 'admin';
  ELSIF OLD.status = 'delivered' AND NEW.status = 'returned' THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_RETURN_ADMIN_ONLY';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.seller_order_id = OLD.id
        AND r.status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'BETK_RETURN_NOT_ACCEPTED';
    END IF;
  ELSE
    RAISE EXCEPTION 'BETK_ILLEGAL_ORDER_TRANSITION: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$;

-- release_seller_orders. Plan §1.7. One admin deposit confirm releases
-- every pending child of that master and copies the master proof onto
-- each other deposit row (ADR-021). EXECUTE revoked.
CREATE OR REPLACE FUNCTION betk.release_seller_orders(p_master_id uuid, p_skip_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_proof text;
  v_reference text;
BEGIN
  SELECT proof_path, transfer_reference
    INTO v_proof, v_reference
  FROM betk.master_orders
  WHERE id = p_master_id;

  PERFORM set_config('betk.internal_release', '1', true);

  UPDATE betk.payments AS p
  SET proof_path = v_proof,
      transfer_reference = v_reference,
      proof_snapshot_at = now(),
      status = 'confirmed',
      confirmed_at = COALESCE(p.confirmed_at, now()),
      confirmed_by = COALESCE(p.confirmed_by, auth.uid())
  WHERE p.payment_type = 'deposit'
    AND p.id IS DISTINCT FROM p_skip_payment_id
    AND p.order_id IN (
      SELECT s.id
      FROM betk.seller_orders AS s
      WHERE s.master_order_id = p_master_id
    );

  UPDATE betk.seller_orders AS s
  SET status = 'confirmed',
      confirmed_at = now(),
      prep_deadline = (
        SELECT now() + make_interval(days => mx.d)
        FROM (
          SELECT max(i.prep_days_snapshot)::integer AS d
          FROM betk.order_items AS i
          WHERE i.order_id = s.id
        ) AS mx
        WHERE mx.d IS NOT NULL
      )
  WHERE s.master_order_id = p_master_id
    AND s.status = 'pending';

  PERFORM set_config('betk.internal_release', '', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.release_seller_orders(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- enforce_payment_update full rework (plan §1.7, ADR-021, D2).
-- Buyer cannot write child proof. On admin deposit confirm, copy the
-- master proof onto this row and call release_seller_orders.
-- On balance confirm, stamp balance_confirmed_at only.
-- FLAG-REFUND: refunded_subtotal is not written.
CREATE OR REPLACE FUNCTION betk.enforce_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_master_id uuid;
  v_proof text;
  v_reference text;
BEGIN
  IF current_setting('betk.internal_release', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount
     OR NEW.proof_snapshot_at IS DISTINCT FROM OLD.proof_snapshot_at THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_PAYMENT_ADMIN_ONLY';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'confirmed') THEN
      RAISE EXCEPTION 'BETK_ILLEGAL_PAYMENT_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.proof_path IS DISTINCT FROM OLD.proof_path
     OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference THEN
    RAISE EXCEPTION 'BETK_PAYMENT_PROOF_FORBIDDEN';
  END IF;

  IF OLD.payment_type = 'deposit'
     AND OLD.status = 'pending'
     AND NEW.status = 'confirmed' THEN
    SELECT m.id, m.proof_path, m.transfer_reference
      INTO v_master_id, v_proof, v_reference
    FROM betk.seller_orders AS s
    JOIN betk.master_orders AS m ON m.id = s.master_order_id
    WHERE s.id = OLD.order_id;
    NEW.proof_path := v_proof;
    NEW.transfer_reference := v_reference;
    NEW.proof_snapshot_at := now();
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := now();
    END IF;
    IF NEW.confirmed_by IS NULL THEN
      NEW.confirmed_by := auth.uid();
    END IF;
    PERFORM betk.release_seller_orders(v_master_id, OLD.id);
  ELSIF OLD.payment_type = 'balance'
        AND OLD.status = 'pending'
        AND NEW.status = 'confirmed' THEN
    UPDATE betk.seller_orders
    SET balance_confirmed_at = now()
    WHERE id = OLD.order_id
      AND balance_confirmed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- restore_stock_on_cancel. Plan §1.7, ERD §7, REG-82. Not on returned.
-- FLAG-PREDELIVERY: pending, confirmed, preparing, ready.
CREATE OR REPLACE FUNCTION betk.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.status <> 'cancelled'::betk.order_status
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR OLD.status NOT IN (
       'pending'::betk.order_status,
       'confirmed'::betk.order_status,
       'preparing'::betk.order_status,
       'ready'::betk.order_status
     ) THEN
    RETURN NEW;
  END IF;

  UPDATE betk.listings AS l
  SET stock_qty = l.stock_qty + agg.qty,
      status = CASE
        WHEN l.status = 'sold_out'::betk.listing_status
             AND l.stock_qty + agg.qty > 0
        THEN 'active'::betk.listing_status
        ELSE l.status
      END,
      updated_at = now()
  FROM (
    SELECT i.listing_id, sum(i.quantity)::integer AS qty
    FROM betk.order_items AS i
    WHERE i.order_id = NEW.id
    GROUP BY i.listing_id
  ) AS agg
  WHERE l.id = agg.listing_id
    AND l.stock_qty IS NOT NULL;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  )
  SELECT NEW.buyer_id, i.listing_id, i.quantity, i.unit_price, false, NULL
  FROM betk.order_items AS i
  WHERE i.order_id = NEW.id
    AND i.inquiry_id IS NULL;

  INSERT INTO betk.cart_items (
    buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
  )
  SELECT NEW.buyer_id, i.listing_id, i.quantity, i.unit_price, true, i.inquiry_id
  FROM betk.order_items AS i
  JOIN betk.inquiries AS q ON q.id = i.inquiry_id
  WHERE i.order_id = NEW.id
    AND i.inquiry_id IS NOT NULL
    AND q.quote_expires_at > now();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.restore_stock_on_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON betk.seller_orders;
CREATE TRIGGER trg_restore_stock_on_cancel
  AFTER UPDATE OF status ON betk.seller_orders
  FOR EACH ROW
  EXECUTE FUNCTION betk.restore_stock_on_cancel();

-- enforce_store_category_cap. Plan §1.7. Empty seller_category_limit
-- fails closed (plan §8.2.5 shape: empty is not unlimited).
CREATE OR REPLACE FUNCTION betk.enforce_store_category_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_raw text;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT value INTO v_raw
  FROM betk.admin_settings
  WHERE key = 'seller_category_limit';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_CATEGORY_LIMIT_UNCONFIGURED';
  END IF;
  v_limit := btrim(v_raw)::integer;
  SELECT count(*)::integer INTO v_count
  FROM betk.store_categories
  WHERE store_id = NEW.store_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'BETK_STORE_CATEGORY_CAP';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_store_category_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_store_category_cap ON betk.store_categories;
CREATE TRIGGER trg_enforce_store_category_cap
  BEFORE INSERT ON betk.store_categories
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_store_category_cap();

-- Payout INSERT cap. ERD §6.4. G3: a non-terminal dispute or return
-- drops that seller order from the sum. rejected payouts are not
-- "requested or processed".
CREATE OR REPLACE FUNCTION betk.enforce_payout_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_available numeric(10,2);
  v_used numeric(10,2);
BEGIN
  SELECT COALESCE(sum(s.subtotal - COALESCE(s.commission_amount, 0) - s.refunded_subtotal), 0)
    INTO v_available
  FROM betk.seller_orders AS s
  WHERE s.store_id = NEW.store_id
    AND s.balance_confirmed_at IS NOT NULL
    AND s.payout_eligible_at <= now()
    AND NOT EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.order_id = s.id
        AND d.status::text NOT IN (
          'closed', 'resolved', 'rejected', 'refunded', 'cancelled'
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.seller_order_id = s.id
        AND r.status::text NOT IN (
          'closed', 'resolved', 'rejected', 'refunded', 'cancelled'
        )
    );

  SELECT COALESCE(sum(p.amount), 0)
    INTO v_used
  FROM betk.payouts AS p
  WHERE p.store_id = NEW.store_id
    AND p.status IN ('pending', 'processing', 'processed');

  IF NEW.amount > v_available - v_used THEN
    RAISE EXCEPTION 'BETK_PAYOUT_CAP';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_payout_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_payout_cap ON betk.payouts;
CREATE TRIGGER trg_enforce_payout_cap
  BEFORE INSERT ON betk.payouts
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_payout_cap();

-- ADR-023 / CF-3. Pickup writes must already equal stores.governorate.
-- A store governorate update copies onto the pickup row (AFTER, so the
-- pickup trigger reads the new store value).
CREATE OR REPLACE FUNCTION betk.enforce_pickup_governorate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_gov character varying(50);
BEGIN
  SELECT governorate INTO v_gov
  FROM betk.stores
  WHERE id = NEW.store_id;
  IF v_gov IS DISTINCT FROM NEW.governorate THEN
    RAISE EXCEPTION 'BETK_PICKUP_GOVERNORATE_MISMATCH';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_pickup_governorate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pickup_governorate_eq ON betk.store_pickup_addresses;
CREATE TRIGGER trg_pickup_governorate_eq
  BEFORE INSERT OR UPDATE ON betk.store_pickup_addresses
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_pickup_governorate();

CREATE OR REPLACE FUNCTION betk.sync_store_governorate_to_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.governorate IS DISTINCT FROM OLD.governorate THEN
    UPDATE betk.store_pickup_addresses
    SET governorate = NEW.governorate
    WHERE store_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.sync_store_governorate_to_pickup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_store_governorate_eq ON betk.stores;
CREATE TRIGGER trg_store_governorate_eq
  AFTER UPDATE OF governorate ON betk.stores
  FOR EACH ROW
  EXECUTE FUNCTION betk.sync_store_governorate_to_pickup();

-- enforce_master_proof_update. Plan §1.7, ERD §7. Buyer, once, before
-- payment_deadline, while every child is pending. Stamps proof_uploaded_at.
CREATE OR REPLACE FUNCTION betk.enforce_master_proof_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.proof_path IS NOT DISTINCT FROM OLD.proof_path
     AND NEW.transfer_reference IS NOT DISTINCT FROM OLD.transfer_reference THEN
    RETURN NEW;
  END IF;

  IF OLD.proof_path IS NOT NULL
     OR OLD.transfer_reference IS NOT NULL
     OR OLD.proof_uploaded_at IS NOT NULL THEN
    RAISE EXCEPTION 'BETK_PROOF_ALREADY_SET';
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'BETK_PROOF_FORBIDDEN';
  END IF;

  IF NEW.proof_path IS NULL OR NEW.transfer_reference IS NULL THEN
    RAISE EXCEPTION 'BETK_PROOF_INCOMPLETE';
  END IF;

  IF OLD.payment_deadline IS NULL OR now() >= OLD.payment_deadline THEN
    RAISE EXCEPTION 'BETK_PROOF_DEADLINE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.seller_orders AS s
    WHERE s.master_order_id = OLD.id
      AND s.status IS DISTINCT FROM 'pending'::betk.order_status
  ) THEN
    RAISE EXCEPTION 'BETK_PROOF_CHILDREN_NOT_PENDING';
  END IF;

  NEW.proof_uploaded_at := now();
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_master_proof_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_master_proof_update ON betk.master_orders;
CREATE TRIGGER trg_enforce_master_proof_update
  BEFORE UPDATE ON betk.master_orders
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_master_proof_update();

-- checkout_from_cart. Same signature as the M6 shell (C1).
-- Stock: order_items INSERT fires decrement_stock_on_confirm, which
-- updates stock_qty; trg_touch_stock stamps stock_touched_at.
-- betk_ref: BETK-YYYYMMDD-XXXX (R-O02, ERD §6.1 master). Child betk_ref
-- and display_ref stay NULL (REG-81, plan §1.7).
-- Payments: R-O17 two obligations per seller order; ADR-022 one master
-- deposit allocated across child deposit rows; balance method cod.
-- A non-positive amount is not inserted (payments.amount > 0).
-- Hidden columns are INSERT targets from locals. They are not selected
-- and not returned (CF-2).
CREATE OR REPLACE FUNCTION betk.checkout_from_cart(p_delivery_address_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
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

  -- FLAG-REG-88. Read. Do not branch.
  v_terms := betk.checkout_agreement_version('agreement_buyer_terms_version');
  v_seller_agreement := betk.checkout_agreement_version('agreement_seller_agreement_version');
  v_return_policy := betk.checkout_agreement_version('agreement_return_policy_version');
  v_privacy := betk.checkout_agreement_version('agreement_privacy_version');

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
        sum(
          c.quantity * CASE
            WHEN c.is_custom THEN q.quoted_price
            ELSE l.price
          END
        ) AS subtotal
      FROM betk.cart_items AS c
      JOIN betk.listings AS l ON l.id = c.listing_id
      LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
      WHERE c.buyer_id = v_uid
      GROUP BY l.store_id
    ) AS g
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
    NULL,
    u.rate_id
  FROM unnest(v_ids, v_stores, v_fees, v_subs, v_child, v_rates)
    AS u(id, store_id, fee, subtotal, child_total, rate_id);

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
    CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
    c.quantity * CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
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

-- CF-4. Last statements (plan §6 M8).
DROP TRIGGER IF EXISTS trg_set_inquiry_converted_order ON betk.seller_orders;
DROP FUNCTION IF EXISTS betk.set_inquiry_converted_order();
