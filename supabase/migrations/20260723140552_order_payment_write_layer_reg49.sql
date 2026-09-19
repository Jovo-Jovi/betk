-- REG-49 — payments INSERT/UPDATE + orders UPDATE write layer + checkout RPC (Phase 07 / T02b).
-- ERD BETK_ERD.md §3 rows 54 (orders) / 57 (payments) / 71 (moderation_logs) + the 2026-07-23
-- OD-8 † amendment. Additive only; never DROP. Consumes T01's ORDER-SET CONTRACT + T02a's audit.
--
-- Corrections applied vs the T02a proposed DDL block:
--  F1  orders GRANT drops cancelled_by (now trigger-stamped, like confirmed_at) -> GRANT(status,
--      cancellation_reason). enforce_order_transition guards cancel-metadata OUTSIDE the status
--      branch (BETK_CANCEL_METADATA_FORBIDDEN unless pending->cancelled) and stamps NEW.cancelled_by
--      from the actor. cancelled_by_type members = buyer,seller,admin,system (live pg_enum); the
--      cancel branch is buyer-only (SUB-DECISION A) so the literal is 'buyer'.
--  F2  enforce_payment_update constrains the TRANSITION (only pending->confirmed) as well as the
--      actor; anything else RAISEs BETK_ILLEGAL_PAYMENT_TRANSITION (refunded/failed = Phase 10/14).
--  F3  modlog_admin_insert: ERD §3 row 71 = INSERT admin, basis modlog_admin. Live column list shows
--      moderation_logs.admin_id NOT NULL FK->users (an actor column exists). Per the order_messages /
--      inq_msg_insert pinned-actor precedent, admin_id is pinned = auth.uid() (tightening, not a
--      broadening) so an admin cannot forge a log attributed to another admin.
--  F5  set_order_commission_snapshot RAISEs BETK_COMMISSION_CONFIG_MISSING if the commission_rate_pct
--      row is ABSENT (missing key = config fault). An explicit '0' (or empty) passes through as 0.
--
-- SUB-DECISION A (resolved this session): DROP 'OR betk.is_admin()' from all three actor checks in
--   enforce_order_transition (accept / preparing / cancel). KEEP betk.is_admin() in the orders_update
--   POLICY (ERD §3 row 54 'store/admin' verbatim). The policy admits admin (ERD-faithful); the trigger
--   restricts Phase-07 transitions to the specific actors. Phase 14 amends the trigger for
--   admin-forced cancellation. confirmed_at stays ungranted + trigger-stamped.
--
-- TRAP 1 (ii) AUTHORIZED this session: settings_payment_config_read (REG-69, STANDING). The key IN (...)
--   allow-list is LITERAL and must NEVER become a prefix/pattern/NOT-IN; no secret may ever be stored
--   under these four keys. Commission stays server-side-only via the DEFINER commission trigger (i).
--
-- anon RETAINS its pre-existing table-wide UPDATE on orders/payments (harmless: both new UPDATE
--   policies are TO authenticated and RLS is on, so anon matches no row; auth.uid() is null; ADR-015
--   precedent). We do NOT revoke anon here. NOTE FOR THE FUTURE: because that grant persists, any
--   future TO public UPDATE policy on these tables would inherit anon's column grant silently -> such
--   a policy MUST be TO authenticated or must first re-scope anon's grant.
--
-- Registrations: REG-49 CLOSED (this migration). REG-68 minted+CLOSED (moderation_logs admin INSERT,
--   #14-class). REG-69 minted STANDING (admin_settings allow-list literal).
--
-- Advisor projection: every policy lands on an already-policied table (admin_settings/payments/orders/
--   moderation_logs) -> no rls_enabled_no_policy change. The 3 new DEFINER trigger fns are
--   search_path-pinned + EXECUTE-revoked from PUBLIC/anon/authenticated (never PostgREST-exposed) ->
--   no 0011/0028/0029. create_order_from_inquiry is SECURITY INVOKER + search_path-pinned ->
--   no 0028/0029 (DEFINER-only) and no 0011. REVOKE/GRANT add nothing. Expected 8/6/2/4/1 UNCHANGED.
SET search_path TO betk, public;

-- ═══ (0) TRAP 1 (ii): admin_settings buyer-read broadening — AUTHORIZED (REG-69 STANDING) ═══
-- Buyer must SEE the BETK payment handles + the flat delivery fee at checkout. settings_admin stays
-- (admin sees all rows); this OR-combines a narrow SELECT for authenticated over EXACTLY these 4 keys.
-- commission_rate_pct + return_hold_hours are DELIBERATELY EXCLUDED (commission is read server-side by
-- the DEFINER trigger; return_hold_hours is a Phase-13 settlement detail). REG-69 STANDING: the key IN
-- (...) allow-list is LITERAL — it must NEVER become a prefix/pattern (e.g. key LIKE 'betk_%') or a
-- NOT-IN, and NO secret (API key, webhook secret, payout threshold) may ever be stored under these
-- four keys. anon is excluded (TO authenticated).
CREATE POLICY settings_payment_config_read ON betk.admin_settings FOR SELECT
  TO authenticated
  USING (key IN ('betk_instapay_handle','betk_vodafone_cash','betk_orange_cash','delivery_fee_flat_egp'));

-- ═══ (1) payments INSERT — ERD §3 row 57 INSERT = 'system (checkout)' ════════════════════════
-- Buyer creating their OWN order's payment rows through the ADR-018 INVOKER rpc. Mirrors
-- order_items_insert (20260723074953). No admin/seller INSERT branch (buyer-of-parent only).
CREATE POLICY payments_insert ON betk.payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid())
  );

-- ═══ (2) payments UPDATE — TRAP 2 three-layer (column GRANT + row policy + OLD-aware trigger) ═══
-- ERD §3 row 57 UPDATE (OD-8 †): admin confirms {status,confirmed_by,confirmed_at,notes}; buyer
-- attaches {proof_path,transfer_reference} to their OWN deposit row only.
-- Layer 1 — column GRANT (REG-42 pattern): re-scope authenticated's table-wide UPDATE to the 6
-- writable columns; amount/payment_type/order_id/method/id/created_at become UNTOUCHABLE by any
-- authenticated caller (a forbidden write => 42501, not a silent 0-row no-op).
REVOKE UPDATE ON betk.payments FROM authenticated;
GRANT  UPDATE (status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference)
       ON betk.payments TO authenticated;
-- Layer 2 — permissive row policy: parties via the parent order. THE SELLER GETS NO payments UPDATE.
CREATE POLICY payments_update ON betk.payments FOR UPDATE TO authenticated
  USING      ( betk.is_admin()
            OR EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid()) )
  WITH CHECK ( betk.is_admin()
            OR EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = payments.order_id AND o.buyer_id = auth.uid()) );
-- Layer 3 — OLD-aware BEFORE UPDATE trigger: actor↔column legality + transition legality (F2).
CREATE OR REPLACE FUNCTION betk.enforce_payment_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
BEGIN
  -- admin-only columns
  IF ( NEW.status IS DISTINCT FROM OLD.status
    OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
    OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    OR NEW.notes IS DISTINCT FROM OLD.notes ) THEN
    IF NOT betk.is_admin() THEN
      RAISE EXCEPTION 'BETK_PAYMENT_ADMIN_ONLY';
    END IF;
  END IF;
  -- F2: transition legality — the ONLY admitted status change is pending -> confirmed.
  -- refunded/failed belong to Phase 10/14 and are not admitted here.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'confirmed') THEN
      RAISE EXCEPTION 'BETK_ILLEGAL_PAYMENT_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  -- buyer proof attach: own pending deposit row only
  IF ( NEW.proof_path IS DISTINCT FROM OLD.proof_path
    OR NEW.transfer_reference IS DISTINCT FROM OLD.transfer_reference ) THEN
    IF NOT ( OLD.payment_type = 'deposit' AND OLD.status = 'pending'
         AND EXISTS (SELECT 1 FROM betk.orders o WHERE o.id = OLD.order_id AND o.buyer_id = auth.uid()) ) THEN
      RAISE EXCEPTION 'BETK_PAYMENT_PROOF_FORBIDDEN';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.enforce_payment_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_payment_update BEFORE UPDATE ON betk.payments
  FOR EACH ROW EXECUTE FUNCTION betk.enforce_payment_update();

-- ═══ (3) orders UPDATE — TRAP 2 three-layer (F1 + SUB-DECISION A) ════════════════════════════
-- ERD §3 row 54 UPDATE = store/admin (OD-8 † also admits buyer cancel-while-pending, R-O03).
-- Layer 1 — column GRANT (F1): only status + cancellation_reason are client-writable. cancelled_by is
-- NOT granted (trigger-stamps it, like confirmed_at). money/betk_ref/buyer_id/store_id/delivered_at/
-- tracking stay UNTOUCHABLE (a buyer editing total_amount => 42501).
REVOKE UPDATE ON betk.orders FROM authenticated;
GRANT  UPDATE (status, cancellation_reason) ON betk.orders TO authenticated;
-- Layer 2 — permissive row policy: buyer own OR store OR admin (ERD row 54 verbatim; admin KEPT here
-- per SUB-DECISION A — the trigger, not the policy, scopes the transitions).
CREATE POLICY orders_update ON betk.orders FOR UPDATE TO authenticated
  USING      ( buyer_id = auth.uid() OR store_id = betk.my_store_id() OR betk.is_admin() )
  WITH CHECK ( buyer_id = auth.uid() OR store_id = betk.my_store_id() OR betk.is_admin() );
-- Layer 3 — OLD-aware BEFORE UPDATE trigger: transition legality + cancel-metadata guard + stamps.
-- SUB-DECISION A: admin is DROPPED from the three actor checks (Phase 07 admins touch only payments;
-- Phase 14 amends this trigger for admin-forced cancellation). Phase-08 transitions
-- (dispatched/delivered/returned) are NOT admitted -> RAISE.
CREATE OR REPLACE FUNCTION betk.enforce_order_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
BEGIN
  -- F1: cancel metadata (cancelled_by / cancellation_reason) may change ONLY on a genuine
  -- pending->cancelled transition; any other change RAISEs. Evaluated BEFORE the cancel branch
  -- stamps cancelled_by, so the trigger's own stamp never trips it (cancelled_by is unchanged here
  -- because it is not client-grantable). cancellation_reason IS grantable, so this is the real guard.
  IF ( NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
    OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason ) THEN
    IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
      RAISE EXCEPTION 'BETK_CANCEL_METADATA_FORBIDDEN';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      IF NOT (OLD.store_id = betk.my_store_id()) THEN            -- SUB-DECISION A: store-only
        RAISE EXCEPTION 'BETK_ORDER_ACCEPT_STORE_ONLY';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM betk.payments p               -- AC-SEL-14 custodial gate (DB-authoritative)
                     WHERE p.order_id = OLD.id AND p.payment_type = 'deposit' AND p.status = 'confirmed') THEN
        RAISE EXCEPTION 'BETK_DEPOSIT_UNCONFIRMED';
      END IF;
      NEW.confirmed_at := now();                                -- ungranted col, stamped here
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'preparing' THEN
      IF NOT (OLD.store_id = betk.my_store_id()) THEN            -- SUB-DECISION A: store-only
        RAISE EXCEPTION 'BETK_ORDER_PREPARING_STORE_ONLY';
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      IF OLD.status <> 'pending' THEN                            -- R-O03: cancel only from pending
        RAISE EXCEPTION 'BETK_NOT_CANCELLABLE';
      END IF;
      IF NOT (OLD.buyer_id = auth.uid()) THEN                    -- SUB-DECISION A: buyer-only
        RAISE EXCEPTION 'BETK_ORDER_CANCEL_BUYER_ONLY';
      END IF;
      NEW.cancelled_by := 'buyer'::betk.cancelled_by_type;      -- F1: stamp actor (buyer) server-side
    ELSE
      RAISE EXCEPTION 'BETK_ILLEGAL_ORDER_TRANSITION: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.enforce_order_transition() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_order_transition BEFORE UPDATE ON betk.orders
  FOR EACH ROW EXECUTE FUNCTION betk.enforce_order_transition();

-- ═══ (4) TRAP 1 (i): commission snapshot via DEFINER BEFORE INSERT (buyer never reads the rate) ═══
-- Reads admin_settings.commission_rate_pct server-side; commission on SUBTOTAL (never total_amount).
-- F5: a MISSING commission_rate_pct row is a config fault (RAISE), NOT 0%. Explicit '0' passes as 0.
CREATE OR REPLACE FUNCTION betk.set_order_commission_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = betk, public AS $$
DECLARE v_raw text; v_rate numeric;
BEGIN
  SELECT value INTO v_raw FROM betk.admin_settings WHERE key = 'commission_rate_pct';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BETK_COMMISSION_CONFIG_MISSING';   -- F5: missing key = config fault, not 0%
  END IF;
  v_rate := COALESCE(NULLIF(v_raw, '')::numeric, 0);    -- explicit '0' (or empty) -> 0 per the pack
  NEW.commission_rate   := v_rate;                                 -- chk_commission_rate_range 0..100
  NEW.commission_amount := round(v_rate / 100 * NEW.subtotal, 2);  -- chk_commission_amount_nonneg; base = subtotal
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.set_order_commission_snapshot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_set_order_commission_snapshot BEFORE INSERT ON betk.orders
  FOR EACH ROW EXECUTE FUNCTION betk.set_order_commission_snapshot();

-- ═══ (5) moderation_logs INSERT — ERD §3 row 71 INSERT = admin (#14-class; REG-68 minted+CLOSED) ═══
-- LIVE: only modlog_admin (SELECT) exists; INSERT was default-denied for all incl. admin. F3: the
-- table carries admin_id NOT NULL FK->users (an actor column) -> per the order_messages / inq_msg_insert
-- pinned-actor precedent, pin admin_id = auth.uid() (a tightening: an admin cannot forge a log
-- attributed to a different admin). UPDATE/DELETE stay unpoliced (append-only RULES no_update_mod_log
-- / no_delete_mod_log rewrite them to no-ops regardless of RLS).
CREATE POLICY modlog_admin_insert ON betk.moderation_logs FOR INSERT
  WITH CHECK (betk.is_admin() AND admin_id = auth.uid());

-- ═══ (6) ADR-018 — checkout is ONE atomic SECURITY INVOKER rpc ═══════════════════════════════
-- INVOKER so orders_insert + orders_phone_gate (OD-4 verified phone) + order_items_insert +
-- payments_insert + order_status_history_insert all bite THROUGH the buyer, no hand-rolled checks.
-- PostgREST wraps one per-request transaction => order + items + 2 payments + history commit or roll
-- back together (AC-BUY-6). Amounts are SERVER-AUTHORITATIVE: subtotal from listing.price*qty,
-- delivery_fee RE-READ from admin_settings (via settings_payment_config_read as invoker=buyer; NEVER
-- an rpc parameter), total = subtotal + delivery_fee (chk_order_total), 50/50 split in SQL. Commission
-- is set by the BEFORE INSERT trigger (buyer never reads the rate). converted_to_order_id is left to
-- ADR-017's AFTER INSERT trigger. status INSERTs 'pending'; NO auto-confirm.
-- F4: the betk_ref (R-O02, BETK-YYYYMMDD-XXXX) uniqueness retry sits inside a plpgsql
-- BEGIN...EXCEPTION WHEN unique_violation block (implicit savepoint) — a bare retry would run on an
-- aborted transaction.
CREATE OR REPLACE FUNCTION betk.create_order_from_inquiry(
  p_inquiry_id uuid,
  p_address_id uuid,
  p_delivery_method betk.delivery_preference,
  p_deposit_method betk.payment_method
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = betk, public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_inq      betk.inquiries;
  v_listing  betk.listings;
  v_qty      integer;
  v_unit     numeric;
  v_subtotal numeric;
  v_fee      numeric;
  v_total    numeric;
  v_deposit  numeric;
  v_balance  numeric;
  v_order_id uuid;
  v_ref      text;
  v_attempt  int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'BETK_UNAUTHENTICATED'; END IF;

  -- source inquiry: own + confirmed + not-yet-converted (R-O01). RLS (inq_buyer) also filters, so a
  -- foreign inquiry returns NOT FOUND; the explicit buyer_id check is belt-and-suspenders.
  SELECT * INTO v_inq FROM betk.inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND OR v_inq.buyer_id <> v_uid THEN RAISE EXCEPTION 'BETK_INQUIRY_NOT_FOUND'; END IF;
  IF v_inq.status <> 'confirmed' THEN RAISE EXCEPTION 'BETK_INQUIRY_NOT_CONFIRMED'; END IF;
  IF v_inq.converted_to_order_id IS NOT NULL THEN RAISE EXCEPTION 'BETK_ALREADY_CONVERTED'; END IF;

  -- deposit must go to a BETK electronic rail (never cod — cod is the balance leg)
  IF p_deposit_method NOT IN ('instapay','vodafone_cash','orange_cash') THEN
    RAISE EXCEPTION 'BETK_INVALID_DEPOSIT_METHOD';
  END IF;

  -- address must be the caller's own
  IF NOT EXISTS (SELECT 1 FROM betk.addresses a WHERE a.id = p_address_id AND a.buyer_id = v_uid) THEN
    RAISE EXCEPTION 'BETK_ADDRESS_NOT_FOUND';
  END IF;

  -- listing (server-resolved price; never client-supplied)
  SELECT * INTO v_listing FROM betk.listings WHERE id = v_inq.listing_id;
  IF NOT FOUND OR v_listing.price IS NULL THEN RAISE EXCEPTION 'BETK_LISTING_UNPRICED'; END IF;

  v_qty      := COALESCE(v_inq.quantity, 1);
  v_unit     := v_listing.price;
  v_subtotal := round(v_unit * v_qty, 2);

  -- delivery fee RE-RESOLVED server-side (never an rpc param). Engineering decision (UNPINNED): the
  -- flat fee applies to ALL delivery methods incl. pickup/remote (see action header). Missing/empty -> 0.
  SELECT COALESCE(NULLIF(value,'')::numeric, 0) INTO v_fee
  FROM betk.admin_settings WHERE key = 'delivery_fee_flat_egp';
  v_fee   := COALESCE(v_fee, 0);

  v_total   := round(v_subtotal + v_fee, 2);
  v_deposit := round(v_total / 2, 2);
  v_balance := v_total - v_deposit;

  -- R-O02 betk_ref w/ uniqueness retry inside a per-INSERT savepoint (F4)
  LOOP
    v_attempt := v_attempt + 1;
    v_ref := 'BETK-' || to_char(now() AT TIME ZONE 'UTC','YYYYMMDD') || '-'
             || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    BEGIN
      INSERT INTO betk.orders (betk_ref, buyer_id, store_id, inquiry_id, delivery_address_id,
                               delivery_method, delivery_fee, subtotal, total_amount, status)
      VALUES (v_ref, v_uid, v_inq.store_id, v_inq.id, p_address_id,
              p_delivery_method, v_fee, v_subtotal, v_total, 'pending')
      RETURNING id INTO v_order_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN RAISE EXCEPTION 'BETK_REF_RETRY_EXHAUSTED'; END IF;
      -- retry with a fresh ref; the implicit savepoint rolled back only this INSERT
    END;
  END LOOP;

  -- order_items: single line from the inquiry's listing (title snapshot, listing_title_ar NOT NULL)
  INSERT INTO betk.order_items (order_id, listing_id, listing_title_ar, quantity, unit_price, subtotal)
  VALUES (v_order_id, v_listing.id, v_listing.title_ar, v_qty, v_unit, v_subtotal);

  -- exactly TWO payments rows, both pending (50/50; NO pure-COD path)
  INSERT INTO betk.payments (order_id, payment_type, amount, method, status)
  VALUES (v_order_id, 'deposit', v_deposit, p_deposit_method, 'pending'),
         (v_order_id, 'balance', v_balance, 'cod',            'pending');

  -- initial status-history row (append-only). changed_by_type is cancelled_by_type.
  INSERT INTO betk.order_status_history (order_id, from_status, to_status, changed_by, changed_by_type, notes)
  VALUES (v_order_id, NULL, 'pending', v_uid, 'buyer', 'order created');

  RETURN v_order_id;
END; $$;
REVOKE EXECUTE ON FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method) TO authenticated;
