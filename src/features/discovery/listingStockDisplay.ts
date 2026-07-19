/**
 * Listing Detail — sold-out / quote_only stock display rules. Phase 03 / T05
 * (R-L09, R-N06). Extracted as pure functions so the page's business logic is
 * unit-testable without a live Supabase round-trip.
 *
 * R-L09 ("quote_only hides quantity/price-paid") — PriceBlock already hides
 * the price entirely for `quote_only` (its own component logic). "Hides
 * quantity" is interpreted here as: NEVER show the exact remaining count
 * (StockBadge's "low → N left" branch is the only place a number appears at
 * all), while still surfacing a genuine sold-out/in-stock/service/
 * made-to-order STATE — availability is a status, not a quantity, and the
 * R-N06 restock CTA still needs to fire correctly for a quote_only listing
 * that is genuinely out of stock. Flagged as an interpretation (not
 * literally spelled out beyond the one-line pack summary) in the T05
 * close-out, not silently assumed.
 */

import type { ListingDetail } from "./types";

export type ListingForStockDisplay = Pick<
  ListingDetail,
  "type" | "status" | "priceType" | "stockQty" | "lowStockThreshold" | "isMadeToOrder"
>;

export interface StockDisplayProps {
  state?: "in_stock" | "low" | "sold_out" | "made_to_order" | "service";
  stockQty?: number | null;
  lowStockThreshold?: number;
  isMadeToOrder?: boolean;
  isService?: boolean;
}

/** Derives the safe `StockBadge` prop combination for a listing. */
export function deriveStockDisplayProps(listing: ListingForStockDisplay): StockDisplayProps {
  if (listing.type === "service") return { isService: true };
  if (listing.isMadeToOrder) return { isMadeToOrder: true };

  // REG-25: a genuinely `sold_out`-status listing (now publicly visible on the
  // detail page) reads out-of-stock even if `stock_qty` were non-zero. The
  // enum is the source of truth; `stock_qty<=0` is the coupled reachable path.
  const outOfStock =
    listing.status === "sold_out" ||
    (typeof listing.stockQty === "number" && listing.stockQty <= 0);
  if (outOfStock) {
    return typeof listing.stockQty === "number"
      ? { stockQty: listing.stockQty }
      : { state: "sold_out" };
  }

  if (listing.priceType === "quote_only") {
    // Never reveal the exact remaining count for a negotiated-price listing.
    return { state: "in_stock" };
  }

  return { stockQty: listing.stockQty, lowStockThreshold: listing.lowStockThreshold };
}

/** True when the R-N06 "notify me" restock CTA should replace the inquiry CTA. */
export function isListingSoldOut(
  listing: Pick<ListingDetail, "type" | "status" | "isMadeToOrder" | "stockQty">,
): boolean {
  if (listing.type === "service") return false;
  // REG-25: the `sold_out` enum is authoritative; `stock_qty<=0` is the coupled
  // reachable path (the decrement_stock_on_confirm trigger sets both together).
  if (listing.status === "sold_out") return true;
  if (listing.isMadeToOrder) return false;
  return typeof listing.stockQty === "number" && listing.stockQty <= 0;
}
