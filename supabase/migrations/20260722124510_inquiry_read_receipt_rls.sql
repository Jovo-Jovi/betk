-- REG-42 — inquiry_messages receiver read-receipt write path (Phase 06 / T02-FIX).
-- Closes the REG-42 unread WRITE-path gap under an AUTHORIZED ERD §3 row-52 amendment
-- (BETK_ERD.md §3, 2026-07-22): the RECEIVER of a message may flip is_read on the OTHER
-- party's messages. Additive + grant re-scope, per REG-24. Never DROPs inq_msg_update.
--
-- Mechanism (column safety = GRANT, row safety = policy):
--   1. Re-scope authenticated's table-level UPDATE (granted schema-wide in 0013_grants) down
--      to the is_read column only. After this, NO authenticated caller can UPDATE body/content/
--      any other column on inquiry_messages — a body edit is DENIED BY THE GRANT (permission
--      error), not merely filtered to zero rows. This also NARROWS the pre-existing sender
--      policy inq_msg_update: the sender retains USING/WITH CHECK sender_id=auth.uid() but can
--      now only touch is_read (content-edit becomes a no-op). inq_msg_update is NOT dropped or
--      altered — it simply operates within the narrowed column grant.
--   2. Add a permissive UPDATE policy inq_msg_read_receipt (TO authenticated) authorizing the
--      RECEIVER: caller is a party to the parent inquiry AND is NOT the message's sender.
--      OR-combined with inq_msg_update (sender), this lets each party mark the OTHER party's
--      messages read, still column-confined to is_read by step 1.
--
-- Other roles UNCHANGED: service_role/postgres keep ALL (RLS-bypass background/admin); anon
-- keeps its schema-wide table grant but has NO applicable policy (read_receipt is TO
-- authenticated; the public policies need auth.uid()) → anon UPDATE stays default-denied.
--
-- Style mirrors REG-41 (20260722115026): bare auth.uid() + SECURITY DEFINER helpers
-- my_store_id()/is_admin(); REG-36 (select-wrap) is a separate batch, not smuggled here.

-- 1. Column-level UPDATE re-scope for authenticated (is_read only).
REVOKE UPDATE ON betk.inquiry_messages FROM authenticated;
GRANT UPDATE (is_read) ON betk.inquiry_messages TO authenticated;

-- 2. Receiver read-receipt policy (party to the inquiry AND not the sender).
CREATE POLICY inq_msg_read_receipt ON betk.inquiry_messages FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );
