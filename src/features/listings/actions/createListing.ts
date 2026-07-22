"use server";

/**
 * createListing — Phase 05 / T02 (FR-SEL-9). Creates a listing as status='draft'
 * (ADR-013 draft-first decomposition). Never throws to the client — returns a
 * discriminated `CreateListingResult`.
 *
 * ATOMICITY (ADR-013): a create is a SINGLE-TABLE `betk.listings` INSERT, so it
 * is atomically fine on its own. Tags (a child table) are written as an
 * independent follow-up (syncListingTags) — a draft with partial children is a
 * VALID state; publish validation is what requires completeness. Images are NOT
 * written here — they're uploaded + attached via addListingImage (T04
 * ImageUploader flow). Hence NO rpc is needed (contrast ADR-012's multi-table
 * atomic submit).
 *
 * OWN-STORE SCOPE: store_id = the caller's own store (resolved from the live
 * session), so the `listings_seller` RLS WITH CHECK (store_id = my_store_id())
 * is satisfied and the insert can only ever land under the caller's store.
 *
 * R-L09: type='service' → stock fields stripped server-side (stock_qty NULL,
 * is_made_to_order false) regardless of client input. R-L01/R-L04: category is
 * required (Zod + NOT NULL). chk_listing_price (price required unless
 * quote_only) is DB-authoritative; Zod pre-validates. search_vector is
 * maintained by the live trg_listing_search_vector trigger (no app work).
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
  createListingSchema,
  type CreateListingInput,
  type CreateListingResult,
} from "@/validations/listings";
import { stripServiceStockFields } from "@/features/listings/listingRules";
import type { Database, Json } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";
import { syncListingTags } from "./_shared";

type ListingInsert = Database["betk"]["Tables"]["listings"]["Insert"];

export async function createListing(
  input: CreateListingInput,
): Promise<CreateListingResult> {
  setFeatureContext("listing");

  const parsed = createListingSchema.safeParse(input);
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

  // R-L09: services never carry stock.
  const stock = stripServiceStockFields(p.type, {
    stockQty: p.stockQty ?? null,
    isMadeToOrder: p.isMadeToOrder ?? false,
  });

  const insert: ListingInsert = {
    store_id: scope.storeId,
    category_id: p.categoryId,
    subcategory_id: p.subcategoryId ?? null,
    type: p.type,
    title_ar: p.titleAr,
    title_en: p.titleEn, // REG-15: both titles required at the Zod layer
    description_ar: p.descriptionAr ?? null,
    price: p.priceType === "quote_only" ? null : (p.price ?? null),
    price_type: p.priceType,
    stock_qty: stock.stockQty,
    is_made_to_order: stock.isMadeToOrder,
    accepts_custom_orders: p.acceptsCustomOrders ?? false,
    custom_order_notes: p.customOrderNotes ?? null,
    status: "draft",
  };
  if (p.lowStockThreshold !== undefined && p.type !== "service") {
    insert.low_stock_threshold = p.lowStockThreshold;
  }
  if (p.deliveryOptions !== undefined) {
    insert.delivery_options = p.deliveryOptions as Json;
  }

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .insert(insert)
    .select("id")
    .single();

  if (error || !data) {
    captureTaggedError(error ?? new Error("createListing: no row"), "listing", {
      extra: { step: "insertListing" },
    });
    return { ok: false, reason: "error" };
  }

  // Independent child write (ADR-013). A tag failure doesn't invalidate the
  // draft — surface it as an error so the caller can retry the tag edit.
  if (p.tags && p.tags.length > 0) {
    const tagErr = await syncListingTags(supabase, data.id, p.tags);
    if (tagErr) {
      captureTaggedError(new Error(`createListing tags: ${tagErr}`), "listing", {
        extra: { step: "syncTags", listingId: data.id },
      });
      // The draft exists; report success with the id so the form keeps it and
      // the seller can re-try tags on edit (partial-children is a valid draft).
    }
  }

  captureServerEvent(userId, "listing_created", { type: p.type });
  return { ok: true, listingId: data.id };
}
