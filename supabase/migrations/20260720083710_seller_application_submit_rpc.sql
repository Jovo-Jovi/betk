-- Phase 04 / T03 (ADR-012) — atomic seller-application submit RPC.
-- betk.submit_seller_application(...) writes seller_profiles + stores + 2
-- seller_documents in ONE transaction (PostgREST wraps each rpc call in a
-- transaction; any failure rolls back every row -> no partial residue).
--
-- SECURITY INVOKER (NOT DEFINER) — ADR-012:
--   * RLS is NOT bypassed, so the RESTRICTIVE seller_profiles_phone_gate bites
--     naturally (OD-4 / REG-10 honored at the DB layer, no hand-rolled check),
--     and the permissive sp_insert / stores_insert / sdoc_own WITH CHECKs
--     enforce id / seller_id = auth.uid() ownership.
--   * Avoids advisor 0028/0029 — a SECURITY DEFINER function granted to
--     authenticated would add a new authenticated_security_definer_function_
--     executable finding, which the "no new advisor findings" bar forbids.
-- The betk.users.role flip is intentionally NOT here (betk.users has no
-- permissive UPDATE policy; an INVOKER function cannot update it). It runs LAST
-- via the service-role setUserRole() helper after this rpc commits, so the
-- seller_profiles row provably exists before the flip (REG-19; ADR-012 order).
--
-- SET search_path pins resolution (clears advisor 0011); pg_catalog is always
-- implicitly first, so now() resolves.
create or replace function betk.submit_seller_application(
  p_name_ar             text,
  p_name_en             text,
  p_bio_ar              text,
  p_slug                text,
  p_category_primary    text,
  p_category_secondary  text,
  p_governorate         text,
  p_city                text,
  p_payment_methods     jsonb,
  p_delivery_options    jsonb,
  p_return_policy       text,
  p_min_order_egp       numeric,
  p_doc_front_path      text,
  p_doc_back_path       text
)
returns void
language plpgsql
security invoker
set search_path = betk, public
as $$
declare
  v_uid uuid := auth.uid();
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  -- 1) seller_profiles FIRST — RESTRICTIVE seller_profiles_phone_gate rejects a
  --    phone-NULL caller here (OD-4); sp_insert enforces id = auth.uid();
  --    a pre-existing application -> PK 23505 (R-S01, mapped below).
  insert into betk.seller_profiles (id, status, level, submitted_at)
  values (v_uid, 'pending', 'bronze', now());

  -- 2) stores — stores_insert enforces seller_id = auth.uid(); uq_stores_slug
  --    (R-S02) + uq_stores_seller (R-S01) are the authoritative uniqueness guards.
  insert into betk.stores (
    seller_id, name_ar, name_en, slug, bio_ar,
    category_primary, category_secondary, governorate, city,
    payment_methods, delivery_options, return_policy, min_order_egp, status
  )
  values (
    v_uid, p_name_ar, p_name_en, p_slug, p_bio_ar,
    p_category_primary, p_category_secondary, p_governorate, p_city,
    coalesce(p_payment_methods, '{}'::jsonb),
    coalesce(p_delivery_options, '{}'::jsonb),
    p_return_policy, p_min_order_egp, 'pending'
  );

  -- 3) seller_documents — front + back (R-S05); sdoc_own enforces
  --    seller_id = auth.uid(); review_status defaults 'pending'.
  insert into betk.seller_documents (seller_id, document_type, storage_path, review_status)
  values
    (v_uid, 'national_id_front', p_doc_front_path, 'pending'),
    (v_uid, 'national_id_back',  p_doc_back_path,  'pending');

exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'uq_stores_slug' then
      raise exception 'BETK_SLUG_TAKEN';
    elsif v_constraint in ('seller_profiles_pkey', 'uq_stores_seller', 'uq_seller_doc_type') then
      raise exception 'BETK_APPLICATION_EXISTS';
    else
      raise;
    end if;
end;
$$;

-- Advisor-clean EXECUTE hardening (R2 pattern, adapted for an authenticated
-- rpc): drop the default PUBLIC grant, grant only to authenticated. SECURITY
-- INVOKER means 0028/0029 do not apply regardless; this keeps anon out too.
revoke all on function betk.submit_seller_application(
  text, text, text, text, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) from public;
grant execute on function betk.submit_seller_application(
  text, text, text, text, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) to authenticated;
