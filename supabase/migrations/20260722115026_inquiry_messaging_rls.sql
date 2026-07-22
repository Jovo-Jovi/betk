-- REG-41 — inquiries + inquiry_messages RLS policies (Phase 06 / T01).
-- ERD BETK_ERD.md §3 rows 51-52:
--   | inquiries        | buyer or store or admin | buyer         | store/admin | — | inq_buyer   |
--   | inquiry_messages | thread parties          | thread parties| sender      | — | via inquiry |
-- 5th instance of the open-issue-#14 / REG-29 / REG-31 / REG-34 class (ERD §3-specced
-- policies absent from the shipped Phase-01 SQL contract). Additive only; never DROP.
--
-- inquiries SELECT: ALREADY covered by the pre-existing inq_buyer policy, whose live
--   USING is ((buyer_id = auth.uid()) OR (store_id = betk.my_store_id()) OR betk.is_admin())
--   = ERD row 51 "buyer or store or admin" verbatim. No second SELECT policy is added
--   (would be a redundant multiple-permissive). inq_buyer is LEFT UNTOUCHED.
-- inquiries INSERT = buyer: WITH CHECK (buyer_id = auth.uid()). No phone gate — ERD §1.2
--   gates only orders/seller_profiles/payouts; inquiries are pre-transaction.
-- inquiries UPDATE = store/admin: the confirm→checkout transition surface (T02 confirmInquiry
--   flips status to 'confirmed'). Scoped via my_store_id() OR is_admin(); buyers cannot UPDATE.
-- inquiry_messages SELECT/INSERT = thread parties (parent inquiry's buyer_id OR parent
--   inquiry's store via my_store_id() OR is_admin()); INSERT additionally pins sender_id to
--   the caller (sender_id = auth.uid()).
-- inquiry_messages UPDATE = sender own rows only (this is where the is_read read-state column
--   lives). NO DELETE policy on either table (ERD "—").
--
-- Style mirrors the existing betk policies (inq_buyer / listing_images_seller / sp_insert):
--   bare auth.uid() + the SECURITY DEFINER helpers my_store_id()/is_admin(), default (public)
--   roles. REG-36 (auth.uid() -> (select auth.uid()) wrap) is a separate dedicated batch and
--   is intentionally NOT applied here (consistent-style, not smuggled).

-- ── inquiries ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY inq_insert ON betk.inquiries FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY inq_update ON betk.inquiries FOR UPDATE
  USING (store_id = betk.my_store_id() OR betk.is_admin())
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

-- ── inquiry_messages ──────────────────────────────────────────────────────────────────────
CREATE POLICY inq_msg_select ON betk.inquiry_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

CREATE POLICY inq_msg_insert ON betk.inquiry_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM betk.inquiries i
      WHERE i.id = inquiry_messages.inquiry_id
        AND (i.buyer_id = auth.uid() OR i.store_id = betk.my_store_id() OR betk.is_admin())
    )
  );

CREATE POLICY inq_msg_update ON betk.inquiry_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
