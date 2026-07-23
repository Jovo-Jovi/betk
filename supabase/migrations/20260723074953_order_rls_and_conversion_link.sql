-- REG-09 + REG-48 — order-set RLS foundation + the converted_to_order_id linkage
-- trigger (Phase 07 / T01). ERD BETK_ERD.md §3 rows 53-59 + §1.2 transaction gate.
--
-- Additive only; never DROP. Closes the next instances of the open-issue-#14 /
-- REG-29 / REG-31 / REG-34 / REG-41 class (ERD §3-specced policies absent from the
-- shipped Phase-01 SQL contract). Verified absent live (pg_policies, 2026-07-23):
--   orders  = orders_access (SELECT) + RESTRICTIVE orders_phone_gate (INSERT) only
--             -> NO permissive INSERT (REG-09), NO UPDATE.
--   order_items / order_status_history / order_messages / shipments /
--   shipment_tracking_events = RLS-enabled, ZERO policies (default-deny).
--   payments = payments_access (SELECT) only (INSERT/UPDATE absent -> REG-49, T02).
--
-- Advisor delta: rls_enabled_no_policy 13 -> 8 (order_items, order_status_history,
-- order_messages, shipments, shipment_tracking_events gain policies). The new
-- SECURITY DEFINER trigger fn is search_path-pinned + EXECUTE-revoked (like
-- decrement_stock_on_confirm) so it adds NO 0011/0028/0029 finding. All other
-- advisor lines byte-identical.
SET search_path TO betk, public;

-- ── REG-09: orders permissive ownership INSERT (ERD row 54 INSERT = buyer) ──────
-- Combines with the pre-existing RESTRICTIVE orders_phone_gate (OD-4 / ERD §1.2):
-- an INSERT passes only if this permissive WITH CHECK (buyer owns the row) AND the
-- RESTRICTIVE gate (caller has a verified phone) both hold. Mirrors sp_insert /
-- stores_insert / inq_insert. Flips the RLS-smoke A4b finding to a PASS.
CREATE POLICY orders_insert ON betk.orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- ── REG-48: order-children READ + checkout/actor INSERT, parent-scoped ──────────
-- order_items (ERD row 55): SELECT = follows order (buyer own OR owning store OR
--   admin, via the parent order); INSERT = "system (checkout)" = the buyer creating
--   their own order's items (the ADR-016 checkout runs SECURITY INVOKER as the
--   buyer). UPDATE/DELETE = "—" (omitted; order_items are immutable snapshots).
CREATE POLICY order_items_access ON betk.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_items.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_items_insert ON betk.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_items.order_id
        AND o.buyer_id = auth.uid()
    )
  );

-- order_status_history (ERD row 56): SELECT = follows order (parties); INSERT =
--   "system/actor" = any party to the order (the app layer writes a history row on
--   each transition it performs — no status-history trigger is specced in ERD §7).
--   UPDATE/DELETE = append-only: the live RULES no_update_order_history /
--   no_delete_order_history (DO INSTEAD NOTHING) rewrite any UPDATE/DELETE to a
--   no-op REGARDLESS of RLS, so no UPDATE/DELETE policy is added.
CREATE POLICY order_status_history_access ON betk.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_status_history_insert ON betk.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

-- order_messages (ERD row 53): the POST-ORDER thread (distinct from inquiry_messages,
--   Phase 06). SELECT/INSERT = order parties; INSERT pins sender_id = auth.uid()
--   (mirrors inq_msg_select / inq_msg_insert). UPDATE = "sender" is a content-edit
--   right with NO MVP edit surface, and — unlike inquiry_messages row 52 (REG-42) —
--   order_messages row 53 was NOT amended with a receiver is_read right, so no
--   read-state write is pinned this phase (cite-or-omit -> OMITTED; is_read stays
--   unused). NO DELETE (ERD "—").
CREATE POLICY order_messages_access ON betk.order_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY order_messages_insert ON betk.order_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

-- shipments / shipment_tracking_events (ERD row 59): SELECT = order parties or admin.
--   DECISION (T01): land the READ policies now so FR-BUY-9's /orders/[id] tracking
--   section can query them (renders empty until Phase 08 populates), and DEFER the
--   store/courier INSERT/UPDATE WRITE policies to Phase 08 (BETK_PHASES: shipment
--   CREATE is Phase 08). shipment_tracking_events is scoped via parent shipment -> order.
CREATE POLICY shipments_access ON betk.shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.orders o
      WHERE o.id = shipments.order_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
CREATE POLICY shipment_tracking_events_access ON betk.shipment_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.shipments s
      JOIN betk.orders o ON o.id = s.order_id
      WHERE s.id = shipment_tracking_events.shipment_id
        AND (o.buyer_id = auth.uid() OR o.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

-- ── NAMED TENSION resolution: converted_to_order_id writer (option a) ────────────
-- Checkout is buyer-driven (buyer INSERTs the order) but inquiries UPDATE RLS =
-- store/admin only (inq_update) — the buyer CANNOT write inquiries.converted_to_order_id.
-- A hardened SECURITY DEFINER AFTER INSERT trigger copies the new order id onto the
-- source inquiry, fired once (idempotent via the converted_to_order_id IS NULL guard
-- — first order wins). REG-43 4(b) shape, JUSTIFIED here by a real cross-row linkage
-- invariant (not a read-ordering convenience). NOT the ADR-012-rejected DEFINER: that
-- rejected a definer *RPC* callable by authenticated (advisor 0028/0029 + phone-gate
-- bypass). This is a definer *TRIGGER* with EXECUTE revoked from PUBLIC/anon/
-- authenticated (never API-exposed) — identical hardening to decrement_stock_on_confirm,
-- so advisor-clean. The buyer's order INSERT stays fully RLS-gated (REG-09 + phone
-- gate); only the derived inquiry-linkage write is definer.
CREATE OR REPLACE FUNCTION betk.set_inquiry_converted_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = betk, public
AS $$
BEGIN
  UPDATE betk.inquiries
  SET converted_to_order_id = NEW.id
  WHERE id = NEW.inquiry_id
    AND converted_to_order_id IS NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION betk.set_inquiry_converted_order() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_set_inquiry_converted_order
AFTER INSERT ON betk.orders
FOR EACH ROW
WHEN (NEW.inquiry_id IS NOT NULL)
EXECUTE FUNCTION betk.set_inquiry_converted_order();
