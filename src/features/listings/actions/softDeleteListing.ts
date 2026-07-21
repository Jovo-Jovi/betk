"use server";

/**
 * softDeleteListing — Phase 05 / T02 (FR-SEL-8, R-L10). Soft-deletes a listing.
 * Never throws — returns a discriminated `SoftDeleteListingResult`.
 *
 * R-L10 SEMANTICS (cited, not invented — schema/ERD/UI-Spec pinned):
 *   Soft delete sets BOTH `status='removed'` AND `deleted_at=now()` together:
 *     • `deleted_at` is the ADR-006 / BETK_ERD §5 soft-delete mechanism —
 *       `getListingById` (public detail) filters `deleted_at IS NULL`, so a
 *       removed listing 404s publicly (FR-PUB-4 "removed → 404 (R-L10)").
 *     • `status='removed'` is the live `listing_status` enum value the Listings
 *       Management "removed" filter tab reads (BETK_UI_SPEC §5.8: status tabs
 *       draft/active/sold_out/paused/removed) and keeps it out of active browse.
 *   CHILDREN ARE NOT DELETED — historical `order_items` reference listings
 *   (BETK_ERD §5), and the public child SELECT policies already hide them
 *   (parent not active/sold_out). SELLER-SIDE RESTORE IS NOT SPECCED (only the
 *   ADMIN listings page has remove/restore — BETK_UI_SPEC §7, Phase 14), so no
 *   restore/un-remove action is built here.
 *
 * SINGLE-TABLE UPDATE (ADR-013), own-store scoped, guarded `deleted_at IS NULL`
 * so a second delete is a no-op (idempotent). Owner reads (getOwnListings
 * "removed" tab) still surface it; the public side 404s.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  listingIdInputSchema,
  type ListingIdInput,
  type SoftDeleteListingResult,
} from "@/validations/listings";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";

export async function softDeleteListing(
  input: ListingIdInput,
): Promise<SoftDeleteListingResult> {
  setFeatureContext("listing");

  const parsed = listingIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId } = parsed.data;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "listing", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  const supabase = await createClient();
  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return { ok: false, reason: "no_store" };

  const { data: updated, error } = await supabase
    .schema("betk")
    .from("listings")
    .update({ status: "removed", deleted_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: "softDelete" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Already removed, or not the caller's listing. Distinguish for the caller.
    const { data: exists } = await supabase
      .schema("betk")
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("store_id", scope.storeId)
      .maybeSingle();
    // An already-removed row is effectively a success (idempotent delete).
    return exists ? { ok: true } : { ok: false, reason: "not_found" };
  }

  captureServerEvent(userId, "listing_removed");
  return { ok: true };
}
