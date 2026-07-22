"use server";

/**
 * updateListing — Phase 05 / T02 (FR-SEL-9). Edits a listing's content fields.
 * Never throws — returns a discriminated `UpdateListingResult`.
 *
 * SINGLE-TABLE UPDATE (ADR-013), own-store scoped: the WHERE pins BOTH the id
 * and the caller's store_id (on top of `listings_seller` RLS), so a cross-store
 * id updates 0 rows → `not_found`. Does NOT change `status` (publish / pause /
 * softDelete own the lifecycle) or `store_id`. Tags are full-replaced
 * (syncListingTags). Images are managed by the dedicated image actions.
 *
 * R-L09: type='service' → stock fields stripped server-side. REG-15: both
 * titles required (Zod). chk_listing_price / uq_listing_tag stay authoritative.
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
  updateListingSchema,
  type UpdateListingInput,
  type UpdateListingResult,
} from "@/validations/listings";
import { stripServiceStockFields } from "@/features/listings/listingRules";
import type { Database, Json } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";
import { syncListingTags } from "./_shared";

type ListingUpdate = Database["betk"]["Tables"]["listings"]["Update"];

export async function updateListing(
  input: UpdateListingInput,
): Promise<UpdateListingResult> {
  setFeatureContext("listing");

  const parsed = updateListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const p = parsed.data;

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

  const stock = stripServiceStockFields(p.type, {
    stockQty: p.stockQty ?? null,
    isMadeToOrder: p.isMadeToOrder ?? false,
  });

  const update: ListingUpdate = {
    category_id: p.categoryId,
    subcategory_id: p.subcategoryId ?? null,
    type: p.type,
    title_ar: p.titleAr,
    title_en: p.titleEn,
    description_ar: p.descriptionAr ?? null,
    price: p.priceType === "quote_only" ? null : (p.price ?? null),
    price_type: p.priceType,
    stock_qty: stock.stockQty,
    is_made_to_order: stock.isMadeToOrder,
    accepts_custom_orders: p.acceptsCustomOrders ?? false,
    custom_order_notes: p.customOrderNotes ?? null,
    delivery_options: (p.deliveryOptions ?? {}) as Json,
  };
  if (p.type !== "service") {
    update.low_stock_threshold = p.lowStockThreshold ?? 3;
  }

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .update(update)
    .eq("id", p.listingId)
    .eq("store_id", scope.storeId)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: "updateListing" } });
    return { ok: false, reason: "error" };
  }
  if ((data?.length ?? 0) === 0) {
    return { ok: false, reason: "not_found" };
  }

  const tagErr = await syncListingTags(supabase, p.listingId, p.tags ?? []);
  if (tagErr) {
    captureTaggedError(new Error(`updateListing tags: ${tagErr}`), "listing", {
      extra: { step: "syncTags", listingId: p.listingId },
    });
    return { ok: false, reason: "error" };
  }

  captureServerEvent(userId, "listing_updated");
  return { ok: true };
}
