-- P09M1. Phase 09 publish gate and onboarding submit. Not applied to staging.
-- F-P1 narrows when enforce_listing_publish runs. F-P2 requires the four
-- food document types to be approved. T04 applies this file byte-for-byte.
-- One migration transaction. No admin_settings UPDATE. checkout_from_cart
-- is not in this file.
--
-- Sources (SELECT 2026-10-03 unless named):
-- ERD §6.3 publish gate. Pack PHASE_09_V2_SURFACES.md §5 (b) rows.
-- Plan §8.2.5 fail-closed. Live submit_seller_application (15 args, INVOKER,
-- search_path betk, public) and resubmit_seller_application (2 args, INVOKER).
-- Live enforce_store_category_cap is the DEFINER + REVOKE pattern copied here.
-- chk_active_listing_shipping stays the AC-CAT-2 check. It is not repeated.
-- The three live active listings are not scanned and not backfilled.
--
-- CREATE OR REPLACE of the two RPCs keeps their grants (authenticated
-- EXECUTE; public and anon false). This file does not GRANT.

-- Listings publish gate (F-P1). The checks run only when the row is being
-- published: INSERT with status active; UPDATE to active from draft, paused,
-- or removed; or UPDATE that leaves status active and changes type,
-- price_type, price, prep_days, category_id, subcategory_id, or store_id.
-- Every other update returns NEW unchecked, including a stock-only update,
-- sold_out to or from active, and an edit to a non-publish column. Empty
-- prep cap or either price band key fails closed. food_requirements is read
-- and not parsed. F-P2: a food publish needs four distinct food document
-- types with review_status approved. The approved-category check stays.
CREATE OR REPLACE FUNCTION betk.enforce_listing_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
DECLARE
  v_cap_raw text;
  v_cap integer;
  v_min_raw text;
  v_max_raw text;
  v_min numeric;
  v_max numeric;
  v_is_food boolean;
  v_food_raw text;
  v_docs integer;
  v_publish boolean;
BEGIN
  -- F-P1. Check only a publish. Anything else returns NEW unchecked.
  v_publish := FALSE;
  IF TG_OP = 'INSERT' AND NEW.status = 'active'::betk.listing_status THEN
    v_publish := TRUE;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'active'::betk.listing_status THEN
    IF OLD.status IN (
      'draft'::betk.listing_status,
      'paused'::betk.listing_status,
      'removed'::betk.listing_status
    ) THEN
      v_publish := TRUE;
    ELSIF NEW.type IS DISTINCT FROM OLD.type
       OR NEW.price_type IS DISTINCT FROM OLD.price_type
       OR NEW.price IS DISTINCT FROM OLD.price
       OR NEW.prep_days IS DISTINCT FROM OLD.prep_days
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id
       OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
      v_publish := TRUE;
    END IF;
  END IF;
  IF NOT v_publish THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'product'::betk.listing_type THEN
    RAISE EXCEPTION 'BETK_LISTING_TYPE';
  END IF;

  IF NEW.price_type IS DISTINCT FROM 'fixed'::betk.price_type OR NEW.price IS NULL THEN
    RAISE EXCEPTION 'BETK_PRICE_TYPE';
  END IF;

  SELECT value INTO v_cap_raw
  FROM betk.admin_settings
  WHERE key = 'prep_cap_days';
  IF v_cap_raw IS NULL OR btrim(v_cap_raw) !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'BETK_PREP_CAP_UNCONFIGURED';
  END IF;
  v_cap := btrim(v_cap_raw)::integer;
  IF NEW.prep_days IS NULL OR NEW.prep_days < 0 OR NEW.prep_days > v_cap THEN
    RAISE EXCEPTION 'BETK_PREP_CAP';
  END IF;

  SELECT value INTO v_min_raw
  FROM betk.admin_settings
  WHERE key = 'price_band_min_egp';
  SELECT value INTO v_max_raw
  FROM betk.admin_settings
  WHERE key = 'price_band_max_egp';
  IF v_min_raw IS NULL OR btrim(v_min_raw) !~ '^[0-9]+(\.[0-9]+)?$'
     OR v_max_raw IS NULL OR btrim(v_max_raw) !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND_UNCONFIGURED';
  END IF;
  v_min := btrim(v_min_raw)::numeric;
  v_max := btrim(v_max_raw)::numeric;
  IF v_min > v_max THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND_UNCONFIGURED';
  END IF;
  IF NEW.price < v_min OR NEW.price > v_max THEN
    RAISE EXCEPTION 'BETK_PRICE_BAND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM betk.store_categories
    WHERE store_id = NEW.store_id
      AND category_id = NEW.category_id
      AND approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'BETK_CATEGORY_NOT_APPROVED';
  END IF;

  SELECT EXISTS (
    WITH RECURSIVE food AS (
      SELECT id
      FROM betk.categories
      WHERE slug = 'food-beverages'
      UNION ALL
      SELECT c.id
      FROM betk.categories AS c
      JOIN food AS f ON c.parent_id = f.id
    )
    SELECT 1
    FROM food
    WHERE food.id IN (NEW.category_id, NEW.subcategory_id)
  ) INTO v_is_food;

  IF v_is_food THEN
    SELECT value INTO v_food_raw
    FROM betk.admin_settings
    WHERE key = 'food_requirements';
    IF v_food_raw IS NULL OR btrim(v_food_raw) = '' THEN
      RAISE EXCEPTION 'BETK_FOOD_REQUIREMENTS_UNCONFIGURED';
    END IF;

    -- F-P2. Distinct types, and only rows the reviewer approved.
    SELECT count(DISTINCT d.document_type)::integer INTO v_docs
    FROM betk.seller_documents AS d
    JOIN betk.stores AS s
      ON s.id = NEW.store_id
     AND s.seller_id = d.seller_id
    WHERE d.document_type = ANY (ARRAY[
      'food_packaging',
      'food_label',
      'food_expiry',
      'food_social_url'
    ]::betk.doc_type[])
      AND d.review_status = 'approved';
    IF v_docs < 4 THEN
      RAISE EXCEPTION 'BETK_FOOD_APPROVAL_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_listing_publish() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_listing_publish ON betk.listings;
CREATE TRIGGER trg_enforce_listing_publish
  BEFORE INSERT OR UPDATE ON betk.listings
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_listing_publish();

-- Non-admin INSERT cannot stamp store_categories.approved_at.
-- Live store_categories_insert WITH CHECK does not mention the column
-- (SELECT 2026-10-03). UPDATE stays the live admin-only policy; this
-- trigger is BEFORE INSERT only. is_admin() is false when auth.uid() is
-- null, so a service-role INSERT is stored with approved_at null.
CREATE OR REPLACE FUNCTION betk.force_store_category_approved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF NEW.approved_at IS NOT NULL AND NOT betk.is_admin() THEN
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.force_store_category_approved_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_force_store_category_approved_at ON betk.store_categories;
CREATE TRIGGER trg_force_store_category_approved_at
  BEFORE INSERT ON betk.store_categories
  FOR EACH ROW
  EXECUTE FUNCTION betk.force_store_category_approved_at();

-- AC-AGR-3 and REG-65. Argument list is the live 15-arg list. INVOKER.
-- p_category_primary and p_category_secondary are stored on the
-- non-authoritative store columns. They are not matched to categories.id.
-- No store_categories row is inserted here. p_delivery_options is not written.
CREATE OR REPLACE FUNCTION betk.submit_seller_application(p_name_ar text, p_name_en text, p_bio_ar text, p_slug text, p_category_primary text, p_category_secondary text, p_governorate text, p_city text, p_payment_methods jsonb, p_delivery_options jsonb, p_return_policy text, p_min_order_egp numeric, p_doc_front_path text, p_doc_back_path text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'betk', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_constraint text;
  v_version text;
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  v_version := betk.checkout_agreement_version('agreement_seller_agreement_version');
  if v_version is null or btrim(v_version) = '' then
    raise exception 'BETK_AGREEMENT_VERSION_UNCONFIGURED';
  end if;
  if not exists (
    select 1
    from betk.agreement_acceptances
    where user_id = v_uid
      and document = 'seller_agreement'
      and version_label = v_version
      and status = 'accepted'
  ) then
    raise exception 'BETK_SELLER_AGREEMENT_REQUIRED';
  end if;

  insert into betk.seller_profiles (id, status, level, submitted_at)
  values (v_uid, 'pending', 'bronze', now());

  insert into betk.stores (
    seller_id, name_ar, name_en, slug, bio_ar,
    category_primary, category_secondary, governorate, city,
    payment_methods, delivery_options, return_policy, min_order_egp, status
  )
  values (
    v_uid, p_name_ar, p_name_en, p_slug, p_bio_ar,
    p_category_primary, p_category_secondary, p_governorate, p_city,
    coalesce(p_payment_methods, '{}'::jsonb),
    '{}'::jsonb,
    p_return_policy, p_min_order_egp, 'pending'
  );

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
$function$;

-- Same acceptance gate. Argument list is the live 2-arg list. INVOKER.
-- This body does not write stores.delivery_options.
CREATE OR REPLACE FUNCTION betk.resubmit_seller_application(p_doc_front_path text, p_doc_back_path text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'betk', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_version text;
begin
  if v_uid is null then
    raise exception 'BETK_NOT_AUTHENTICATED';
  end if;

  v_version := betk.checkout_agreement_version('agreement_seller_agreement_version');
  if v_version is null or btrim(v_version) = '' then
    raise exception 'BETK_AGREEMENT_VERSION_UNCONFIGURED';
  end if;
  if not exists (
    select 1
    from betk.agreement_acceptances
    where user_id = v_uid
      and document = 'seller_agreement'
      and version_label = v_version
      and status = 'accepted'
  ) then
    raise exception 'BETK_SELLER_AGREEMENT_REQUIRED';
  end if;

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
$function$;
