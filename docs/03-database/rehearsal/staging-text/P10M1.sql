-- P10M1. Cart and quote integrity (part A) and REG-107 (part B).
-- Not applied. T01 authors this file. A later apply is byte-for-byte.
-- One migration transaction. No inner BEGIN or COMMIT. apply_migration
-- wraps the file. Two labelled parts. No new table. No policy. No phone
-- predicate. No admin_settings write. checkout_from_cart is not replaced.
--
-- R-LOCK (planning chat, 2026-10-06). Supersedes "do not regrant any
-- cart_items column" and the row-lock FINDING. checkout_from_cart is
-- SECURITY INVOKER and takes FOR UPDATE on the buyer's cart_items
-- (supabase/migrations/20261003082041_v2_08_functions.sql lines 784-787).
-- PostgreSQL requires UPDATE privilege on at least one column for
-- SELECT ... FOR UPDATE. Part A revokes the table UPDATE and re-grants
-- UPDATE (updated_at) only, to authenticated. cart_items_update still
-- limits the row to the buyer. No price, quantity, listing, or inquiry
-- column is granted.
--
-- R-FREEZE (planning chat, 2026-10-06). checkout_from_cart prices a
-- custom line at the inquiry's live quoted_price
-- (supabase/migrations/20261003082041_v2_08_functions.sql line 869, and
-- order_items.unit_price at line 1044). send_inquiry_quote refuses with
-- BETK_QUOTE_LINE_HELD when any cart_items row references the inquiry,
-- before the quote UPDATE. The function is SECURITY DEFINER, so the
-- check sees every buyer's rows. An expired line is cleared by removing
-- the line, then a fresh quote, then accept.
--
-- R-AVAIL (planning chat, 2026-10-06). add_fixed_cart_item,
-- accept_inquiry_quote, and send_inquiry_quote each refuse when the
-- listing is not status 'active', when deleted_at is set, or when its
-- store is not status 'active'. The store test is the public arm of
-- stores_public (R-S07): status = 'active'. Owner and admin do not
-- bypass it. Codes: add listing BETK_CART_LISTING_UNAVAILABLE, add store
-- BETK_CART_STORE_INACTIVE, accept and send listing
-- BETK_QUOTE_LISTING_UNAVAILABLE, accept and send store
-- BETK_QUOTE_STORE_INACTIVE.
--
-- R-DECLINED (planning chat, 2026-10-06). accept_inquiry_quote and
-- send_inquiry_quote refuse with BETK_QUOTE_DECLINED when the inquiry
-- status is 'declined'. Live inquiry_status (pg_enum, 2026-10-06):
-- open, replied, confirmed, declined, expired. The other four are not
-- refused by this check.
--
-- R-TRIGGER (planning chat, 2026-10-06).
-- trg_recompute_avg_response_hours fires only when
-- NEW.sender_type = 'seller'. The function body is unchanged.
--
-- Sources for the bodies: PHASE_10_CART_QUOTE.md §5 and §6 (R-ENFORCE,
-- R-107, R-LOCK, R-FREEZE, R-AVAIL, R-DECLINED, R-TRIGGER), BETK_PRD.md
-- R-C01, R-C04, R-C06, R-Q01-R-Q05,
-- BETK_ERD.md §6.1 cart_items, computeAvgResponseHours in
-- src/features/messaging/messagingRules.ts lines 82-98.
-- Live facts used below were read 2026-10-06 (MCP execute_sql and
-- list_migrations). Ledger 41, last 20261004172620. This file does not
-- change that.

-- ── Part A. Cart and quote ────────────────────────────────────────────────

-- Fixed-price add. The only authenticated insert. Guest refusal is the
-- body (auth.uid() null). anon has no EXECUTE. unit_price is copied from
-- listings.price and is not rewritten on a later price change. A second
-- fixed line for the same listing is refused; quantity changes go through
-- set_cart_item_quantity. Tracked stock (stock_qty not null) bounds the
-- quantity. Made-to-order and unpriced listings are not this function.
-- R-AVAIL: not active, deleted, or a store that is not active.
CREATE OR REPLACE FUNCTION betk.add_fixed_cart_item(
  p_listing_id uuid,
  p_quantity smallint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_price numeric(10,2);
  v_stock integer;
  v_made boolean;
  v_status betk.listing_status;
  v_price_type betk.price_type;
  v_deleted timestamptz;
  v_store_status betk.store_status;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'BETK_CART_QUANTITY';
  END IF;

  SELECT l.price, l.stock_qty, l.is_made_to_order, l.status, l.price_type, l.deleted_at, s.status
    INTO v_price, v_stock, v_made, v_status, v_price_type, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = p_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_CART_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_CART_STORE_INACTIVE';
  END IF;
  IF v_made
     OR v_price IS NULL
     OR v_price <= 0
     OR v_price_type IS DISTINCT FROM 'fixed'::betk.price_type THEN
    RAISE EXCEPTION 'BETK_CART_NOT_FIXED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.buyer_id = v_uid
      AND c.listing_id = p_listing_id
      AND c.inquiry_id IS NULL
  ) THEN
    RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END IF;

  IF v_stock IS NOT NULL AND p_quantity > v_stock THEN
    RAISE EXCEPTION 'BETK_CART_OUT_OF_STOCK';
  END IF;

  BEGIN
    INSERT INTO betk.cart_items (
      buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
    ) VALUES (
      v_uid, p_listing_id, p_quantity, v_price, false, NULL
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.add_fixed_cart_item(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.add_fixed_cart_item(uuid, smallint) TO authenticated;

-- Quantity change. Own row only. Does not change unit_price. Does not
-- delete: quantity below 1 is refused, and remove stays the DELETE grant.
-- A custom line, a made-to-order listing, or a null stock_qty is not
-- stock-bounded (R-C04, R-L15). A tracked fixed line must be <= stock_qty.
CREATE OR REPLACE FUNCTION betk.set_cart_item_quantity(
  p_cart_item_id uuid,
  p_quantity smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_custom boolean;
  v_listing_id uuid;
  v_stock integer;
  v_made boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'BETK_CART_QUANTITY';
  END IF;

  SELECT c.is_custom, c.listing_id
    INTO v_custom, v_listing_id
  FROM betk.cart_items AS c
  WHERE c.id = p_cart_item_id
    AND c.buyer_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CART_LINE_NOT_FOUND';
  END IF;

  SELECT l.stock_qty, l.is_made_to_order
    INTO v_stock, v_made
  FROM betk.listings AS l
  WHERE l.id = v_listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_CART_LISTING_UNAVAILABLE';
  END IF;

  IF NOT v_custom
     AND NOT v_made
     AND v_stock IS NOT NULL
     AND p_quantity > v_stock THEN
    RAISE EXCEPTION 'BETK_CART_OUT_OF_STOCK';
  END IF;

  UPDATE betk.cart_items
  SET quantity = p_quantity,
      updated_at = now()
  WHERE id = p_cart_item_id
    AND buyer_id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.set_cart_item_quantity(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.set_cart_item_quantity(uuid, smallint) TO authenticated;

-- Quote accept. Own inquiry, quote present, quote_expires_at after now().
-- One custom cart line at quoted_price. Does not rewrite an existing line.
-- Does not re-check the band. No phone check. R-DECLINED refuses status
-- 'declined'. R-AVAIL refuses a listing that is not active, is deleted,
-- or whose store is not active.
CREATE OR REPLACE FUNCTION betk.accept_inquiry_quote(p_inquiry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_listing_id uuid;
  v_qty smallint;
  v_quoted_price numeric(10,2);
  v_prep smallint;
  v_expires timestamptz;
  v_quoted_at timestamptz;
  v_inquiry_status betk.inquiry_status;
  v_listing_status betk.listing_status;
  v_deleted timestamptz;
  v_store_status betk.store_status;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  SELECT i.listing_id, i.quantity, i.quoted_price, i.quoted_prep_days, i.quote_expires_at, i.quoted_at, i.status
    INTO v_listing_id, v_qty, v_quoted_price, v_prep, v_expires, v_quoted_at, v_inquiry_status
  FROM betk.inquiries AS i
  WHERE i.id = p_inquiry_id
    AND i.buyer_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_FOUND';
  END IF;
  IF v_inquiry_status = 'declined'::betk.inquiry_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_DECLINED';
  END IF;
  IF v_quoted_price IS NULL
     OR v_prep IS NULL
     OR v_expires IS NULL
     OR v_quoted_at IS NULL THEN
    RAISE EXCEPTION 'BETK_QUOTE_ABSENT';
  END IF;
  IF v_expires <= now() THEN
    RAISE EXCEPTION 'BETK_QUOTE_EXPIRED';
  END IF;
  IF v_qty IS NULL OR v_qty < 1 THEN
    v_qty := 1;
  END IF;

  SELECT l.status, l.deleted_at, s.status
    INTO v_listing_status, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = v_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_listing_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_STORE_INACTIVE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.buyer_id = v_uid
      AND c.inquiry_id = p_inquiry_id
  ) THEN
    RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END IF;

  BEGIN
    INSERT INTO betk.cart_items (
      buyer_id, listing_id, quantity, unit_price, is_custom, inquiry_id
    ) VALUES (
      v_uid, v_listing_id, v_qty, v_quoted_price, true, p_inquiry_id
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'BETK_CART_LINE_EXISTS';
  END;

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.accept_inquiry_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.accept_inquiry_quote(uuid) TO authenticated;

-- Quote send. Store owner only (my_store_id), not admin. Eligible listing:
-- is_made_to_order or price IS NULL. Band is checkout_quote_multiplier
-- when the listing has a price; the closed interval is stored. An unpriced
-- listing has no numeric floor or ceiling; the multiplier is still called
-- so an unconfigured key writes nothing. Prep null or negative is refused;
-- zero is legal (column check >= 0). quote_expires_at comes from
-- quote_validity_hours. Empty or non-positive-integer fails closed.
-- Does not write status. Does not update cart_items. R-FREEZE reads
-- cart_items and refuses with BETK_QUOTE_LINE_HELD before the UPDATE.
-- R-DECLINED refuses status 'declined'. R-AVAIL refuses a listing that
-- is not active, is deleted, or whose store is not active.
CREATE OR REPLACE FUNCTION betk.send_inquiry_quote(
  p_inquiry_id uuid,
  p_quoted_price numeric,
  p_prep_days smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_store uuid;
  v_listing_id uuid;
  v_list_price numeric(10,2);
  v_made boolean;
  v_quote numeric(10,2);
  v_mult numeric;
  v_raw text;
  v_hours integer;
  v_expires timestamptz;
  v_inquiry_status betk.inquiry_status;
  v_listing_status betk.listing_status;
  v_deleted timestamptz;
  v_store_status betk.store_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'BETK_UNAUTHENTICATED';
  END IF;

  v_store := betk.my_store_id();
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_OWNER';
  END IF;

  SELECT i.listing_id, i.status
    INTO v_listing_id, v_inquiry_status
  FROM betk.inquiries AS i
  WHERE i.id = p_inquiry_id
    AND i.store_id = v_store
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_QUOTE_NOT_OWNER';
  END IF;
  -- DEFINER: this sees every buyer's cart_items row. No buyer filter.
  IF EXISTS (
    SELECT 1
    FROM betk.cart_items AS c
    WHERE c.inquiry_id = p_inquiry_id
  ) THEN
    RAISE EXCEPTION 'BETK_QUOTE_LINE_HELD';
  END IF;
  IF v_inquiry_status = 'declined'::betk.inquiry_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_DECLINED';
  END IF;

  SELECT l.price, l.is_made_to_order, l.status, l.deleted_at, s.status
    INTO v_list_price, v_made, v_listing_status, v_deleted, v_store_status
  FROM betk.listings AS l
  LEFT JOIN betk.stores AS s ON s.id = l.store_id
  WHERE l.id = v_listing_id;
  IF NOT FOUND OR v_deleted IS NOT NULL OR v_listing_status IS DISTINCT FROM 'active'::betk.listing_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_UNAVAILABLE';
  END IF;
  IF v_store_status IS DISTINCT FROM 'active'::betk.store_status THEN
    RAISE EXCEPTION 'BETK_QUOTE_STORE_INACTIVE';
  END IF;
  IF NOT (v_made OR v_list_price IS NULL) THEN
    RAISE EXCEPTION 'BETK_QUOTE_LISTING_INELIGIBLE';
  END IF;

  IF p_prep_days IS NULL OR p_prep_days < 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PREP_REQUIRED';
  END IF;
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END IF;
  BEGIN
    v_quote := p_quoted_price::numeric(10,2);
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END;
  IF v_quote IS NULL OR v_quote <= 0 THEN
    RAISE EXCEPTION 'BETK_QUOTE_PRICE';
  END IF;

  v_mult := betk.checkout_quote_multiplier();
  IF v_list_price IS NOT NULL
     AND (v_quote < v_list_price OR v_quote > v_list_price * v_mult) THEN
    RAISE EXCEPTION 'BETK_QUOTE_OUT_OF_BAND';
  END IF;

  SELECT s.value
    INTO v_raw
  FROM betk.admin_settings AS s
  WHERE s.key = 'quote_validity_hours';
  IF v_raw IS NULL OR btrim(v_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_QUOTE_VALIDITY_UNCONFIGURED';
  END IF;
  BEGIN
    v_hours := btrim(v_raw)::integer;
  EXCEPTION
    WHEN numeric_value_out_of_range THEN
      RAISE EXCEPTION 'BETK_QUOTE_VALIDITY_UNCONFIGURED';
  END;
  v_expires := now() + make_interval(hours => v_hours);

  UPDATE betk.inquiries
  SET quoted_price = v_quote,
      quoted_prep_days = p_prep_days,
      quote_expires_at = v_expires,
      quoted_at = now()
  WHERE id = p_inquiry_id
    AND store_id = v_store;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.send_inquiry_quote(uuid, numeric, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION betk.send_inquiry_quote(uuid, numeric, smallint) TO authenticated;

-- Buyer insert and table update go away. SELECT and DELETE stay.
-- anon is not in this revoke (live ACL is already SELECT only).
-- R-LOCK: UPDATE (updated_at) only, so the invoker row lock still has
-- the privilege PostgreSQL checks. Quantity, unit_price, listing_id,
-- inquiry_id, is_custom, buyer_id, id, and created_at are not granted.
REVOKE INSERT, UPDATE ON TABLE betk.cart_items FROM authenticated;
GRANT UPDATE (updated_at) ON TABLE betk.cart_items TO authenticated;

-- Seller quote columns are not regranted. status stays, because
-- sendInquiryMessage, confirmInquiry, and declineInquiry still update it
-- until T04. service_role is not in this revoke.
REVOKE UPDATE ON TABLE betk.inquiries FROM authenticated;
GRANT UPDATE (status) ON TABLE betk.inquiries TO authenticated;

-- ── Part B. REG-107 ───────────────────────────────────────────────────────

-- AFTER INSERT on inquiry_messages. Mean, across the store's inquiries
-- that have a first seller reply, of (first seller sent_at minus
-- inquiries.created_at) in hours. A negative gap is skipped. Null
-- timestamps are skipped. The mean is rounded to two decimals and capped
-- at 999.99. Null when no gap remains. Same order as
-- computeAvgResponseHours: round, then cap. sender_type 'seller' only.
-- Writes seller_profiles.avg_response_hours for stores.seller_id.
-- enforce_approval_state_actor does not list that column, so this update
-- is not BETK_APPROVAL_STATE_ACTOR. No argument, so a caller cannot pass
-- an arbitrary average. EXECUTE is revoked.
CREATE OR REPLACE FUNCTION betk.recompute_seller_avg_response_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_store_id uuid;
  v_seller uuid;
  v_avg numeric(5,2);
BEGIN
  SELECT i.store_id, s.seller_id
    INTO v_store_id, v_seller
  FROM betk.inquiries AS i
  JOIN betk.stores AS s ON s.id = i.store_id
  WHERE i.id = NEW.inquiry_id;

  IF v_seller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT LEAST(round(avg(gaps.gap_hours)::numeric, 2), 999.99)::numeric(5,2)
    INTO v_avg
  FROM (
    SELECT (EXTRACT(EPOCH FROM (fr.first_sent - i.created_at)) / 3600.0) AS gap_hours
    FROM betk.inquiries AS i
    JOIN LATERAL (
      SELECT min(m.sent_at) AS first_sent
      FROM betk.inquiry_messages AS m
      WHERE m.inquiry_id = i.id
        AND m.sender_type = 'seller'::betk.sender_type
    ) AS fr ON fr.first_sent IS NOT NULL
    WHERE i.store_id = v_store_id
      AND i.created_at IS NOT NULL
  ) AS gaps
  WHERE gaps.gap_hours IS NOT NULL
    AND gaps.gap_hours >= 0;

  UPDATE betk.seller_profiles
  SET avg_response_hours = v_avg
  WHERE id = v_seller;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.recompute_seller_avg_response_hours() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recompute_avg_response_hours ON betk.inquiry_messages;
-- R-TRIGGER: seller messages only. The function body above is unchanged.
CREATE TRIGGER trg_recompute_avg_response_hours
  AFTER INSERT ON betk.inquiry_messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'seller')
  EXECUTE FUNCTION betk.recompute_seller_avg_response_hours();

-- Table UPDATE goes away. The four columns the approval writers still
-- set are regranted. avg_response_hours is not one of them. INSERT and
-- SELECT stay. service_role is not in this revoke. The approval trigger
-- still refuses a seller transition that is not the resubmit shape.
REVOKE UPDATE ON TABLE betk.seller_profiles FROM authenticated;
GRANT UPDATE (rejected_reason, submitted_at, status, approved_at)
  ON TABLE betk.seller_profiles TO authenticated;
