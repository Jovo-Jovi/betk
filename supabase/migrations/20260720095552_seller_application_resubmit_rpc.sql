-- Phase 04 / T05 (ADR-012 pattern) -- atomic seller-application resubmit RPC.
--
-- CONFIRMED STATE MODEL (T05 citations -- do not re-derive without re-reading
-- these sources):
--   * seller_status enum = {pending, active, suspended, banned} ONLY -- no
--     'rejected' member (this file, CREATE TYPE seller_status; live-verified
--     via pg_enum, zero drift). "Rejected" is therefore the COMPOUND state
--     status='pending' AND rejected_reason IS NOT NULL -- BETK_UI_SPEC.md
--     groups "pending/rejected" into the SAME /seller/status routing branch
--     (distinct from suspended/banned's separate "restricted view" branch),
--     corroborating this reading independently of the DB. Resubmitting
--     therefore does NOT change `status` (it never left 'pending'); it only
--     clears rejected_reason back to NULL and refreshes submitted_at.
--   * seller_documents has UNIQUE (seller_id, document_type)
--     (uq_seller_doc_type) -- a second INSERT for the same doc_type is
--     impossible (raises unique_violation -- exactly the exception the
--     submit rpc already maps to BETK_APPLICATION_EXISTS). Resubmission
--     therefore UPDATEs the two existing rows in place: overwrite
--     storage_path, reset review_status='pending', clear reviewed_at,
--     refresh uploaded_at.
--   * No DB trigger/constraint governs this transition (live-verified: zero
--     user-defined triggers on seller_profiles/seller_documents/stores) --
--     entirely app-layer, implemented here.
--   * stores.status is NOT touched: it only ever mirrors seller status at
--     submit time ('pending' literal in submit_seller_application) and a
--     rejection never moves seller_profiles.status away from 'pending' in
--     the first place, so there is nothing to mirror back on resubmit.
--   * Storage-OBJECT retention (R-S08) happens at the STORAGE layer, not
--     here -- the docs bucket has no UPDATE/DELETE policy on storage.objects
--     (see the storage RLS comments in BETK_DATABASE_SCHEMA.sql), so each
--     resubmit upload lands at a NEW object path under the same
--     owner-prefix; the prior object is intentionally left in place
--     (retained). This rpc only repoints the DB row's storage_path to the
--     new object.
--
-- SECURITY INVOKER (ADR-012 precedent) -- RLS is not bypassed: sp_update /
-- sdoc_own (own-row = auth.uid()) enforce ownership naturally. There is no
-- client-supplied id anywhere in this function (it always acts on the
-- caller's OWN auth.uid() rows) -- cross-user access has no code path to
-- even attempt.
create or replace function betk.resubmit_seller_application(
  p_doc_front_path text,
  p_doc_back_path  text
)
returns void
language plpgsql
security invoker
set search_path = betk, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  -- Rejected-only guard, SERVER-SIDE (never trust the caller): only a row
  -- that is status='pending' AND rejected_reason IS NOT NULL qualifies. A
  -- true never-reviewed pending row (rejected_reason IS NULL) or any
  -- active/suspended/banned row updates ZERO rows -> FOUND is false below.
  update betk.seller_profiles
  set rejected_reason = null,
      submitted_at = now()
  where id = v_uid
    and status = 'pending'
    and rejected_reason is not null;

  if not found then
    raise exception 'BETK_NOT_REJECTED';
  end if;

  update betk.seller_documents
  set storage_path = p_doc_front_path,
      review_status = 'pending',
      reviewed_at = null,
      uploaded_at = now()
  where seller_id = v_uid and document_type = 'national_id_front';

  update betk.seller_documents
  set storage_path = p_doc_back_path,
      review_status = 'pending',
      reviewed_at = null,
      uploaded_at = now()
  where seller_id = v_uid and document_type = 'national_id_back';
end;
$$;

-- Advisor-clean EXECUTE hardening (R2/T03 pattern): drop the default PUBLIC
-- grant, grant only to authenticated. SECURITY INVOKER means 0028/0029 do not
-- apply regardless; this keeps anon out too.
revoke all on function betk.resubmit_seller_application(text, text) from public;
grant execute on function betk.resubmit_seller_application(text, text) to authenticated;
