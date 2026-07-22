"use server";

/**
 * publishListing — Phase 05 / T02 (FR-SEL-9). Flips a DRAFT listing to ACTIVE
 * once every publish requirement holds. Never throws — returns a discriminated
 * `PublishListingResult`; a blocked publish returns the UNMET requirements so
 * the T04 form renders the checklist.
 *
 * PUBLISH GATE (each independently blocking):
 *   • R-L02 image          — ≥1 listing_images row
 *   • R-L03 title_ar       — a non-empty Arabic title
 *   • R-L04 category       — category_id set
 *   • R-S09 payment_method — the OWNING STORE's stores.payment_methods has ≥1
 *     method. THIS is the R-S09 enforcement point the Phase-04 T07 payments-page
 *     banner comment cites (the page only configures + warns; publish enforces).
 *
 * REG-15: title_en is NOT gated here — bilingual title is a create/edit Zod
 * requirement (both titles). Only R-L03 (title_ar) gates publish.
 *
 * ATOMICITY (ADR-013): publish is a validated SINGLE-TABLE status UPDATE
 * (draft→active) guarded with `status='draft'` so a concurrent
 * publish/state-change can't double-apply (0 rows → invalid_state). Own-store
 * scoped (id + store_id pinned + `listings_seller` RLS).
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
  type PublishListingResult,
} from "@/validations/listings";
import { evaluatePublishRequirements } from "@/features/listings/listingRules";
import { getTyped, type StorePaymentMethods } from "@/types/jsonb";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";

interface PublishFetchRow {
  title_ar: string;
  category_id: string;
  status: string;
  listing_images: { id: string }[] | null;
}

export async function publishListing(input: ListingIdInput): Promise<PublishListingResult> {
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

  // Load the listing (own-store scoped) + its image count.
  const { data: row, error: readErr } = await supabase
    .schema("betk")
    .from("listings")
    .select("title_ar, category_id, status, listing_images ( id )")
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .maybeSingle();

  if (readErr) {
    captureTaggedError(readErr, "listing", { extra: { step: "readListing" } });
    return { ok: false, reason: "error" };
  }
  if (!row) return { ok: false, reason: "not_found" };
  const listing = row as unknown as PublishFetchRow;

  // R-S09: read the owning store's payment methods.
  const { data: store, error: storeErr } = await supabase
    .schema("betk")
    .from("stores")
    .select("payment_methods")
    .eq("id", scope.storeId)
    .maybeSingle();

  if (storeErr) {
    captureTaggedError(storeErr, "listing", { extra: { step: "readStorePayments" } });
    return { ok: false, reason: "error" };
  }

  const unmet = evaluatePublishRequirements({
    titleAr: listing.title_ar,
    categoryId: listing.category_id,
    imageCount: listing.listing_images?.length ?? 0,
    paymentMethods: store ? getTyped<StorePaymentMethods>(store.payment_methods) : null,
  });

  if (unmet.length > 0) {
    return { ok: false, reason: "unmet_requirements", unmet };
  }

  // Validated flip draft→active (guarded so only a draft transitions).
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("listings")
    .update({ status: "active" })
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .eq("status", "draft")
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "listing", { extra: { step: "flipActive" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Not a draft (already active/paused/sold_out/removed) — nothing to publish.
    return { ok: false, reason: "invalid_state" };
  }

  captureServerEvent(userId, "listing_published");
  return { ok: true };
}
