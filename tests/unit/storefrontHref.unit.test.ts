/**
 * D3 (2026-10-05). The seller storefront link exists only for an active store.
 * Public predicate: stores_public status = 'active'
 * (supabase/migrations/20260622083131_functions_rls.sql L98–99).
 */

import { describe, expect, it } from "vitest";
import { sellerStorefrontHref } from "@/features/store-management/storefrontHref";

describe("sellerStorefrontHref", () => {
  it("returns /store/{slug} when the store is active", () => {
    expect(sellerStorefrontHref({ slug: "north-shop", status: "active" })).toBe("/store/north-shop");
  });

  it("returns null for pending, suspended, any other status, and a missing store", () => {
    expect(sellerStorefrontHref({ slug: "north-shop", status: "pending" })).toBeNull();
    expect(sellerStorefrontHref({ slug: "north-shop", status: "suspended" })).toBeNull();
    expect(sellerStorefrontHref({ slug: "north-shop", status: "closed" })).toBeNull();
    expect(sellerStorefrontHref(null)).toBeNull();
  });
});
