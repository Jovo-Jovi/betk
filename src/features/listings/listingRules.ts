/**
 * Listing write-layer business rules — pure, unit-testable functions. Phase 05
 * / T02 (FR-SEL-8..10). Extracted so the publish gate, media-prefix ownership
 * re-check, and service stock-stripping are provable without a live Supabase
 * round-trip (the `listingStockDisplay.ts` precedent).
 *
 * NOT server-only: imported by the Server Actions AND the unit tests.
 */

import type { StorePaymentMethods, StoreDeliveryOptions } from "@/types/jsonb";

/** The publish-gate requirements (R-L02/03/04 + R-S09). A publish is blocked
 * until every one is met; the UI renders the returned unmet[] as a checklist. */
export type PublishRequirement = "image" | "title_ar" | "category" | "payment_method";

/** Media bucket public-URL infix — everything after it is the object path. */
const MEDIA_PUBLIC_INFIX = "/storage/v1/object/public/media/";

/**
 * Extracts the storage object path from a media-bucket PUBLIC url, or null when
 * the url is not a media public url. Public urls look like:
 *   <SUPABASE_URL>/storage/v1/object/public/media/<uid>/<...>
 * The returned path is decoded and stripped of any query string.
 */
export function mediaObjectPathFromPublicUrl(url: string): string | null {
  const idx = url.indexOf(MEDIA_PUBLIC_INFIX);
  if (idx === -1) return null;
  let path = url.slice(idx + MEDIA_PUBLIC_INFIX.length);
  const q = path.indexOf("?");
  if (q !== -1) path = path.slice(0, q);
  if (path.length === 0) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Leave undecoded if malformed — the prefix check below still applies.
  }
  return path;
}

/**
 * True when a media public url points at an object under the caller's OWN
 * prefix (first path segment === uid) — the server-side re-check of the
 * T01-Phase-04 own-prefix upload contract. A url outside the caller's prefix
 * (or not a media public url at all) is rejected.
 */
export function ownsMediaPrefix(url: string, uid: string): boolean {
  const path = mediaObjectPathFromPublicUrl(url);
  if (!path) return false;
  return path.split("/")[0] === uid;
}

/** R-S09: a store "has a payment method" when ANY handle is set or COD is on. */
export function hasPaymentMethod(pm: StorePaymentMethods | null | undefined): boolean {
  if (!pm) return false;
  const nonEmpty = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;
  return (
    nonEmpty(pm.instapay_handle) ||
    nonEmpty(pm.vodafone_cash) ||
    nonEmpty(pm.orange_cash) ||
    pm.cod_enabled === true
  );
}

/**
 * Evaluates the four publish requirements and returns the UNMET ones (empty =
 * publishable). Each is independently blocking:
 *   • image         — R-L02: ≥1 listing_images row
 *   • title_ar      — R-L03: a non-empty Arabic title
 *   • category      — R-L04: a category is set
 *   • payment_method — R-S09: the owning store has ≥1 payment method
 *
 * REG-15 note: title_en is NOT a publish gate — bilingual title is enforced at
 * the create/edit Zod layer (both titles required). Only title_ar (R-L03) gates
 * publish here.
 */
export function evaluatePublishRequirements(input: {
  titleAr: string | null | undefined;
  categoryId: string | null | undefined;
  imageCount: number;
  paymentMethods: StorePaymentMethods | null | undefined;
}): PublishRequirement[] {
  const unmet: PublishRequirement[] = [];
  if (input.imageCount < 1) unmet.push("image");
  if (!input.titleAr || input.titleAr.trim().length === 0) unmet.push("title_ar");
  if (!input.categoryId) unmet.push("category");
  if (!hasPaymentMethod(input.paymentMethods)) unmet.push("payment_method");
  return unmet;
}

/**
 * R-L09: a `service` listing never carries stock. Regardless of client input,
 * a service's stock_qty is forced NULL and made-to-order forced false
 * server-side (the field is hidden in the UI too, but the server is the
 * authority). Products pass through unchanged.
 */
export function stripServiceStockFields<
  T extends { stockQty?: number | null; isMadeToOrder?: boolean },
>(type: "product" | "service", fields: T): T {
  if (type !== "service") return fields;
  return { ...fields, stockQty: null, isMadeToOrder: false };
}

/** Re-export so callers narrowing listings.delivery_options share one shape. */
export type { StoreDeliveryOptions };
