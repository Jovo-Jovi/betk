-- P09M2. Approval-state columns are admin-only for end users.
-- Not applied to staging. T08-DB authors this file. A later apply is
-- byte-for-byte. One function, three BEFORE INSERT OR UPDATE triggers.
-- No policy. No GRANT. No admin_settings UPDATE.
--
-- Decision S1 (human, 2026-10-04), verbatim:
-- S1 Approval-state columns are admin-only for end users.
--    - On seller_documents, seller_profiles and stores, a BEFORE INSERT OR UPDATE trigger raises BETK_APPROVAL_STATE_ACTOR when the caller is an end user (JWT role 'authenticated') who is not betk.is_admin(), and the row writes an approval-state column. The only exceptions are the app's documented seller writes:
--      • a seller INSERT of seller_documents is forced to review_status 'pending' with reviewed_at NULL (like the approved_at stamp);
--      • resubmit resets review_status to 'pending' and reviewed_at to NULL, and seller_profiles rejected_reason to NULL and submitted_at to now();
--      • submit inserts seller_profiles and stores in their initial 'pending' state.
--    - The service role and server-side roles with no end-user JWT (cron, migrations) are allowed. Admins are allowed.
--    - Read the role from the request JWT claim (auth.role() or request.jwt.claims; cite which). Do not use current_user: it's the owner inside a SECURITY DEFINER function.
--
-- Actor. auth.role() (SELECT 2026-10-04), not current_user:
--   coalesce(
--     nullif(current_setting('request.jwt.claim.role', true), ''),
--     (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
--   )
-- A SECURITY DEFINER body still reads that session setting. current_user
-- would be the function owner. Schema-qualified so the pinned search_path
-- cannot hide auth.
--
-- End user = auth.role() = 'authenticated' AND NOT betk.is_admin().
-- service_role, anon, and a session with no JWT (null role: cron, migrations,
-- postgres) return NEW. is_admin() is the users.role admin/superadmin check.
--
-- Approval-state columns (classification, AUDIT-P09.md P09M2):
--   seller_documents: review_status, reviewed_at
--   seller_profiles: status, suspension_ends_at, level, level_score,
--     is_verified, total_orders_completed, total_reviews_count, strike_count,
--     approved_at, rejected_reason, submitted_at
--   stores: status
-- Seller content columns are not in the checks.

CREATE OR REPLACE FUNCTION betk.enforce_approval_state_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'betk', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR betk.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'seller_documents' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.review_status := 'pending'::betk.doc_review_status;
      NEW.reviewed_at := NULL;
      RETURN NEW;
    END IF;
    IF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      IF NEW.review_status = 'pending'::betk.doc_review_status
         AND NEW.reviewed_at IS NULL THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'seller_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IS DISTINCT FROM 'pending'::betk.seller_status
         OR NEW.level IS DISTINCT FROM 'bronze'::betk.seller_level
         OR NEW.level_score IS DISTINCT FROM 0
         OR NEW.is_verified
         OR NEW.suspension_ends_at IS NOT NULL
         OR NEW.approved_at IS NOT NULL
         OR NEW.rejected_reason IS NOT NULL
         OR NEW.strike_count IS DISTINCT FROM 0
         OR NEW.total_orders_completed IS DISTINCT FROM 0
         OR NEW.total_reviews_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.suspension_ends_at IS DISTINCT FROM OLD.suspension_ends_at
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.level_score IS DISTINCT FROM OLD.level_score
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.total_orders_completed IS DISTINCT FROM OLD.total_orders_completed
       OR NEW.total_reviews_count IS DISTINCT FROM OLD.total_reviews_count
       OR NEW.strike_count IS DISTINCT FROM OLD.strike_count
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.rejected_reason IS DISTINCT FROM OLD.rejected_reason
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      IF NEW.rejected_reason IS NULL
         AND OLD.rejected_reason IS NOT NULL
         AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         AND NEW.status IS NOT DISTINCT FROM OLD.status
         AND NEW.suspension_ends_at IS NOT DISTINCT FROM OLD.suspension_ends_at
         AND NEW.level IS NOT DISTINCT FROM OLD.level
         AND NEW.level_score IS NOT DISTINCT FROM OLD.level_score
         AND NEW.is_verified IS NOT DISTINCT FROM OLD.is_verified
         AND NEW.total_orders_completed IS NOT DISTINCT FROM OLD.total_orders_completed
         AND NEW.total_reviews_count IS NOT DISTINCT FROM OLD.total_reviews_count
         AND NEW.strike_count IS NOT DISTINCT FROM OLD.strike_count
         AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'stores' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IS DISTINCT FROM 'pending'::betk.store_status THEN
        RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'BETK_APPROVAL_STATE_ACTOR';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION betk.enforce_approval_state_actor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_seller_document_approval_state ON betk.seller_documents;
CREATE TRIGGER trg_enforce_seller_document_approval_state
  BEFORE INSERT OR UPDATE ON betk.seller_documents
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();

DROP TRIGGER IF EXISTS trg_enforce_seller_profile_approval_state ON betk.seller_profiles;
CREATE TRIGGER trg_enforce_seller_profile_approval_state
  BEFORE INSERT OR UPDATE ON betk.seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();

DROP TRIGGER IF EXISTS trg_enforce_store_approval_state ON betk.stores;
CREATE TRIGGER trg_enforce_store_approval_state
  BEFORE INSERT OR UPDATE ON betk.stores
  FOR EACH ROW
  EXECUTE FUNCTION betk.enforce_approval_state_actor();
