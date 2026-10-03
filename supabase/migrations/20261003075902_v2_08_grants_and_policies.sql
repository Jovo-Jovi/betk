-- M7 v2_08_grants_and_policies. Plan §1.5, §1.6, §1.8, §6 M7.
-- Column-scoped tables: REVOKE the table privilege, then GRANT columns
-- (pack §2; E1). A later GRANT is not a substitute for that REVOKE.
-- §1.8 storage: no statement. docs_select_own_or_admin stays (plan §1.8).
-- Last statement: GRANT EXECUTE ON checkout_from_cart TO authenticated.

-- seller_orders SELECT list generated 2026-10-02 from staging
-- information_schema.columns (seller_orders, ordinal_position), minus
-- delivery_fee and total_amount (ADR-020, REG-90, plan §1.6, §6 M7).
-- id, betk_ref, buyer_id, store_id, inquiry_id, delivery_address_id,
-- delivery_method, subtotal, status, cancelled_by, cancellation_reason,
-- notes, created_at, confirmed_at, delivered_at, commission_rate,
-- commission_amount, master_order_id, display_ref, courier_rate_id,
-- prep_deadline, escalated_at, escalation_reason, escalation_note,
-- escalation_resolved_at, balance_confirmed_at, refunded_subtotal,
-- payout_eligible_at.

REVOKE SELECT ON TABLE betk.seller_orders FROM anon, authenticated;

GRANT SELECT (
  id,
  betk_ref,
  buyer_id,
  store_id,
  inquiry_id,
  delivery_address_id,
  delivery_method,
  subtotal,
  status,
  cancelled_by,
  cancellation_reason,
  notes,
  created_at,
  confirmed_at,
  delivered_at,
  commission_rate,
  commission_amount,
  master_order_id,
  display_ref,
  courier_rate_id,
  prep_deadline,
  escalated_at,
  escalation_reason,
  escalation_note,
  escalation_resolved_at,
  balance_confirmed_at,
  refunded_subtotal,
  payout_eligible_at
) ON TABLE betk.seller_orders TO authenticated;

-- authenticated UPDATE stays column-narrow (plan §1.6). Keep status and
-- cancellation_reason. Add the three escalation columns ERD §8 / UI P39
-- name. Do not grant the trigger-stamped or hidden columns.
REVOKE UPDATE ON TABLE betk.seller_orders FROM authenticated;

GRANT UPDATE (
  status,
  cancellation_reason,
  escalated_at,
  escalation_reason,
  escalation_note
) ON TABLE betk.seller_orders TO authenticated;

-- anon table-level UPDATE on seller_orders stays (plan §1.6, ADR-019).
-- No TO public UPDATE policy is added.

-- payments authenticated UPDATE (ADR-021, plan §1.6): drop proof columns,
-- keep the admin columns, add refunded_amount. proof_snapshot_at stays
-- ungranted (trigger-stamped). anon table-level UPDATE stays.
REVOKE UPDATE ON TABLE betk.payments FROM authenticated;

GRANT UPDATE (
  status,
  confirmed_at,
  confirmed_by,
  notes,
  refunded_amount
) ON TABLE betk.payments TO authenticated;

-- master_orders (E1, plan §1.6). M2 already revoked the table privilege.
-- Revoke again so this migration does not depend on that earlier statement
-- being the only closer. anon receives nothing.
REVOKE ALL ON TABLE betk.master_orders FROM anon, authenticated;

GRANT SELECT (
  id,
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
  proof_path,
  transfer_reference,
  proof_uploaded_at,
  payment_deadline,
  created_at
) ON TABLE betk.master_orders TO authenticated;

-- INSERT = the columns checkout_from_cart writes (plan §1.6 "checkout
-- columns"). Proof columns are the later UPDATE, not this INSERT.
-- id and created_at keep their defaults and are not in the list.
GRANT INSERT (
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
) ON TABLE betk.master_orders TO authenticated;

GRANT UPDATE (
  proof_path,
  transfer_reference
) ON TABLE betk.master_orders TO authenticated;

-- dispute_messages read receipt (ERD §8, REG-42 shape). Table UPDATE is
-- revoked before the column GRANT. Sender content stays ungranted
-- ("no MVP surface" on the inquiry_messages row this cell copies).
REVOKE UPDATE ON TABLE betk.dispute_messages FROM anon, authenticated;

GRANT UPDATE (is_read) ON TABLE betk.dispute_messages TO authenticated;

-- Policy rewrites (plan §1.5). Replaced policies use (SELECT auth.uid()).
-- order_messages_* keeps the store leg and is not recreated.
-- sessions and otp_tokens stay zero policies. modlog_admin_insert is not
-- added again.

DROP POLICY orders_access ON betk.seller_orders;
CREATE POLICY orders_access ON betk.seller_orders
  FOR SELECT
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  );

DROP POLICY orders_update ON betk.seller_orders;
CREATE POLICY orders_update ON betk.seller_orders
  FOR UPDATE
  TO authenticated
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  )
  WITH CHECK (
    (buyer_id = (SELECT auth.uid()))
    OR (store_id = betk.my_store_id())
    OR betk.is_admin()
  );

DROP POLICY payments_access ON betk.payments;
CREATE POLICY payments_access ON betk.payments
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1
        FROM betk.seller_orders AS o
        WHERE o.id = payments.order_id
          AND o.buyer_id = (SELECT auth.uid())
      )
    )
    OR betk.is_admin()
  );

DROP POLICY shipments_access ON betk.shipments;
CREATE POLICY shipments_access ON betk.shipments
  FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1
        FROM betk.seller_orders AS o
        WHERE o.id = shipments.order_id
          AND o.buyer_id = (SELECT auth.uid())
      )
    )
    OR betk.is_admin()
  );

-- ERD §8 shipments INSERT = checkout. Not live before M7 (plan §1.5).
CREATE POLICY shipments_insert ON betk.shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.seller_orders AS o
      WHERE o.id = shipments.order_id
        AND o.buyer_id = (SELECT auth.uid())
    )
  );

-- ERD §8 shipments UPDATE = admin.
CREATE POLICY shipments_update ON betk.shipments
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

DROP POLICY shipment_tracking_events_access ON betk.shipment_tracking_events;
CREATE POLICY shipment_tracking_events_access ON betk.shipment_tracking_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.shipments AS s
      JOIN betk.seller_orders AS o ON o.id = s.order_id
      WHERE s.id = shipment_tracking_events.shipment_id
        AND (
          o.buyer_id = (SELECT auth.uid())
          OR betk.is_admin()
        )
    )
  );

-- ERD §8 tracking INSERT = admin or service. Service role bypasses RLS.
CREATE POLICY shipment_tracking_events_insert ON betk.shipment_tracking_events
  FOR INSERT
  WITH CHECK (betk.is_admin());

DROP POLICY settings_payment_config_read ON betk.admin_settings;
CREATE POLICY settings_payment_config_read ON betk.admin_settings
  FOR SELECT
  TO authenticated
  USING (
    (key)::text = ANY (
      (ARRAY['betk_instapay_handle'::character varying])::text[]
    )
  );

-- Six formerly zero-policy tables (plan §1.5, ERD §8). Not sessions.
-- Not otp_tokens.

CREATE POLICY dispute_evidence_select ON betk.dispute_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_evidence.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_evidence_insert ON betk.dispute_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_evidence.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_select ON betk.dispute_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_insert ON betk.dispute_messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY dispute_messages_read_receipt ON betk.dispute_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  )
  WITH CHECK (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM betk.disputes AS d
      WHERE d.id = dispute_messages.dispute_id
        AND (
          d.buyer_id = (SELECT auth.uid())
          OR d.store_id = betk.my_store_id()
          OR betk.is_admin()
        )
    )
  );

CREATE POLICY flagged_content_select ON betk.flagged_content
  FOR SELECT
  USING (betk.is_admin());

CREATE POLICY flagged_content_insert ON betk.flagged_content
  FOR INSERT
  WITH CHECK (reported_by = (SELECT auth.uid()));

CREATE POLICY flagged_content_update ON betk.flagged_content
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY restock_alerts_select ON betk.restock_alerts
  FOR SELECT
  USING (
    (buyer_id = (SELECT auth.uid()))
    OR betk.is_admin()
  );

CREATE POLICY restock_alerts_insert ON betk.restock_alerts
  FOR INSERT
  WITH CHECK (buyer_id = (SELECT auth.uid()));

CREATE POLICY restock_alerts_delete ON betk.restock_alerts
  FOR DELETE
  USING (buyer_id = (SELECT auth.uid()));

-- seller_strikes.seller_id references seller_profiles.id, and that id
-- references users.id (schema C1). Own seller is that id.
CREATE POLICY seller_strikes_select ON betk.seller_strikes
  FOR SELECT
  USING (
    (seller_id = (SELECT auth.uid()))
    OR betk.is_admin()
  );

CREATE POLICY seller_strikes_insert ON betk.seller_strikes
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY seller_strikes_update ON betk.seller_strikes
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY whatsapp_templates_select ON betk.whatsapp_templates
  FOR SELECT
  USING (betk.is_admin());

CREATE POLICY whatsapp_templates_insert ON betk.whatsapp_templates
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY whatsapp_templates_update ON betk.whatsapp_templates
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

-- Plan §6 M7 last statement. Not anon. Not PUBLIC.
GRANT EXECUTE ON FUNCTION betk.checkout_from_cart(uuid) TO authenticated;
