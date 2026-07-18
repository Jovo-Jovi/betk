/**
 * Listing Detail stock-display rules — Phase 03 / T05 (R-L09, R-N06).
 * Pure-function unit tests (no DB) for `deriveStockDisplayProps` /
 * `isListingSoldOut` — see `src/features/discovery/listingStockDisplay.ts`
 * for the interpretation this codifies.
 */

import { describe, expect, it } from "vitest";
import {
  deriveStockDisplayProps,
  isListingSoldOut,
  type ListingForStockDisplay,
} from "@/features/discovery/listingStockDisplay";

function listing(overrides: Partial<ListingForStockDisplay> = {}): ListingForStockDisplay {
  return {
    type: "product",
    priceType: "fixed",
    stockQty: 10,
    lowStockThreshold: 3,
    isMadeToOrder: false,
    ...overrides,
  };
}

describe("deriveStockDisplayProps", () => {
  it("service listings always show the service state, ignoring stock fields", () => {
    expect(deriveStockDisplayProps(listing({ type: "service", stockQty: 0 }))).toEqual({
      isService: true,
    });
  });

  it("made-to-order listings always show the made_to_order state", () => {
    expect(deriveStockDisplayProps(listing({ isMadeToOrder: true, stockQty: null }))).toEqual({
      isMadeToOrder: true,
    });
  });

  it("a normal in-stock product passes stockQty/lowStockThreshold through", () => {
    expect(deriveStockDisplayProps(listing({ stockQty: 10, lowStockThreshold: 3 }))).toEqual({
      stockQty: 10,
      lowStockThreshold: 3,
    });
  });

  it("stockQty <= 0 resolves to the sold_out state regardless of price_type", () => {
    expect(deriveStockDisplayProps(listing({ stockQty: 0 }))).toEqual({ stockQty: 0 });
    expect(
      deriveStockDisplayProps(listing({ stockQty: 0, priceType: "quote_only" })),
    ).toEqual({ stockQty: 0 });
  });

  it("R-L09: quote_only + in-stock hides the exact remaining count (never 'low')", () => {
    // Would otherwise be "low" (2 <= threshold 3) — quote_only must not reveal the number.
    expect(
      deriveStockDisplayProps(listing({ priceType: "quote_only", stockQty: 2, lowStockThreshold: 3 })),
    ).toEqual({ state: "in_stock" });
  });

  it("R-L09: quote_only + made-to-order/service still take priority over the quote_only rule", () => {
    expect(
      deriveStockDisplayProps(listing({ priceType: "quote_only", type: "service" })),
    ).toEqual({ isService: true });
  });
});

describe("isListingSoldOut", () => {
  it("true when a tracked product's stock is exactly 0", () => {
    expect(isListingSoldOut(listing({ stockQty: 0 }))).toBe(true);
  });

  it("true when stock has gone negative (defensive — should never happen given the DB CHECK)", () => {
    expect(isListingSoldOut(listing({ stockQty: -1 }))).toBe(true);
  });

  it("false when stock is untracked (null) — e.g. services/made-to-order", () => {
    expect(isListingSoldOut(listing({ stockQty: null }))).toBe(false);
  });

  it("false for services and made-to-order listings even at stockQty 0", () => {
    expect(isListingSoldOut(listing({ type: "service", stockQty: 0 }))).toBe(false);
    expect(isListingSoldOut(listing({ isMadeToOrder: true, stockQty: 0 }))).toBe(false);
  });

  it("false when there is remaining stock", () => {
    expect(isListingSoldOut(listing({ stockQty: 5 }))).toBe(false);
  });
});
