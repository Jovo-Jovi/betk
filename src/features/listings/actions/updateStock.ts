"use server";

/**
 * updateStock — Phase 05 / T02 (FR-SEL-10, R-L07). Sets a product listing's
 * stock_qty (consumed by the Stock & Inventory page, T05). Never throws —
 * returns a discriminated `UpdateStockResult` (`restocked` true when a sold_out
 * listing was flipped back to active).
 *
 * R-L07 RESTOCK — APP-LAYER (cited): there is NO restock trigger on
 * betk.listings (live-verified: the only trigger is trg_listing_search_vector;
 * the R-L06 decrement→sold_out lives on the ORDER-confirm path, not listings).
 * So the SAME statement that sets stock does the restock flip: when the listing
 * is currently `sold_out` and the new stock_qty > 0, status is set back to
 * `active` in the same UPDATE.
 *
 * DELIBERATELY CONSERVATIVE: setting stock to 0 does NOT flip active→sold_out
 * here — that transition is the decrement_stock_on_confirm trigger's domain
 * (R-L06, order-confirm path). Manually zeroing stock leaves status untouched
 * (the public detail still derives out-of-stock from stock_qty<=0). Restock
 * alert dispatch (R-N06) is Phase 12 — restock_alerts is NOT touched here.
 *
 * R-L09: services don't track stock → updateStock on a service is rejected
 * (`invalid`). Own-store scoped (id + store_id pinned + `listings_seller` RLS).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  updateStockSchema,
  type UpdateStockInput,
  type UpdateStockResult,
} from "@/validations/listings";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";

type ListingUpdate = Database["betk"]["Tables"]["listings"]["Update"];

export async function updateStock(input: UpdateStockInput): Promise<UpdateStockResult> {
  setFeatureContext("listing");

  const parsed = updateStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId, stockQty } = parsed.data;

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

  const { data: current, error: readErr } = await supabase
    .schema("betk")
    .from("listings")
    .select("type, status")
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .maybeSingle();

  if (readErr) {
    captureTaggedError(readErr, "listing", { extra: { step: "readListing" } });
    return { ok: false, reason: "error" };
  }
  if (!current) return { ok: false, reason: "not_found" };
  if (current.type === "service") {
    // R-L09: services are untracked; refuse to write a stock number.
    return { ok: false, reason: "invalid" };
  }

  // R-L07: restock a sold_out listing in the SAME statement when new stock > 0.
  const restocked = current.status === "sold_out" && stockQty > 0;
  const update: ListingUpdate = { stock_qty: stockQty };
  if (restocked) update.status = "active";

  const { data: updated, error } = await supabase
    .schema("betk")
    .from("listings")
    .update(update)
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: "updateStock" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    return { ok: false, reason: "not_found" };
  }

  captureServerEvent(userId, "listing_stock_updated", { restocked });
  return { ok: true, restocked };
}
