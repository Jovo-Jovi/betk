/**
 * Listing write-layer pure rules — Phase 05 / T02.
 * Unit tests (no DB) for the publish gate, media own-prefix re-check, payment-
 * method detection, and service stock-stripping — see
 * `src/features/listings/listingRules.ts` — plus the REG-15 bilingual-title
 * requirement + price/tag refinements in `@/validations/listings`.
 */

import { describe, expect, it } from "vitest";
import {
  evaluatePublishRequirements,
  hasPaymentMethod,
  mediaObjectPathFromPublicUrl,
  ownsMediaPrefix,
  stripServiceStockFields,
} from "@/features/listings/listingRules";
import { createListingSchema, updateStockSchema } from "@/validations/listings";

const UID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const CATEGORY = "33333333-3333-3333-3333-333333333333";
const LISTING = "44444444-4444-4444-4444-444444444444";
const publicUrl = (path: string) =>
  `https://ref.supabase.co/storage/v1/object/public/media/${path}`;

describe("mediaObjectPathFromPublicUrl / ownsMediaPrefix", () => {
  it("extracts the object path from a media public url", () => {
    expect(mediaObjectPathFromPublicUrl(publicUrl(`${UID}/listings/a.png`))).toBe(
      `${UID}/listings/a.png`,
    );
  });

  it("strips a query string and decodes the path", () => {
    expect(mediaObjectPathFromPublicUrl(publicUrl(`${UID}/a%20b.png?token=x`))).toBe(
      `${UID}/a b.png`,
    );
  });

  it("returns null for a non-media url", () => {
    expect(mediaObjectPathFromPublicUrl("https://ref.supabase.co/storage/v1/object/public/docs/x/a.png")).toBeNull();
    expect(mediaObjectPathFromPublicUrl("https://evil.test/x.png")).toBeNull();
  });

  it("accepts a url under the caller's own prefix and rejects others", () => {
    expect(ownsMediaPrefix(publicUrl(`${UID}/hero.png`), UID)).toBe(true);
    expect(ownsMediaPrefix(publicUrl(`${OTHER}/hero.png`), UID)).toBe(false);
    expect(ownsMediaPrefix("https://evil.test/x.png", UID)).toBe(false);
  });
});

describe("hasPaymentMethod (R-S09, REG-61 — OD-8 §3.2/§7 custodial model)", () => {
  it("true when any SETTLEMENT handle is set", () => {
    expect(hasPaymentMethod({ instapay_handle: "01000000000" })).toBe(true);
    expect(hasPaymentMethod({ vodafone_cash: "01000000000" })).toBe(true);
    expect(hasPaymentMethod({ orange_cash: "01000000000" })).toBe(true);
  });

  it("REG-61: false for a COD-only store — cod_enabled no longer satisfies the gate", () => {
    expect(hasPaymentMethod({ cod_enabled: true })).toBe(false);
    expect(hasPaymentMethod({ cod_enabled: true, instapay_handle: "   " })).toBe(false);
  });

  it("false when empty / whitespace-only / all disabled / null", () => {
    expect(hasPaymentMethod({})).toBe(false);
    expect(hasPaymentMethod({ instapay_handle: "   " })).toBe(false);
    expect(hasPaymentMethod({ cod_enabled: false })).toBe(false);
    expect(hasPaymentMethod(null)).toBe(false);
    expect(hasPaymentMethod(undefined)).toBe(false);
  });
});

describe("evaluatePublishRequirements (R-L02/03/04 + R-S09, REG-61)", () => {
  const ok = {
    titleAr: "عنوان",
    categoryId: CATEGORY,
    imageCount: 1,
    paymentMethods: { instapay_handle: "01000000000" },
  };

  it("returns [] when all requirements are met", () => {
    expect(evaluatePublishRequirements(ok)).toEqual([]);
  });

  it("flags a missing image (R-L02)", () => {
    expect(evaluatePublishRequirements({ ...ok, imageCount: 0 })).toEqual(["image"]);
  });

  it("flags a missing arabic title (R-L03)", () => {
    expect(evaluatePublishRequirements({ ...ok, titleAr: "  " })).toEqual(["title_ar"]);
  });

  it("flags a missing category (R-L04)", () => {
    expect(evaluatePublishRequirements({ ...ok, categoryId: null })).toEqual(["category"]);
  });

  it("flags a missing payment method (R-S09)", () => {
    expect(evaluatePublishRequirements({ ...ok, paymentMethods: {} })).toEqual([
      "payment_method",
    ]);
  });

  it("REG-61: flags a COD-only store — a pure-COD store now FAILS the gate", () => {
    expect(
      evaluatePublishRequirements({ ...ok, paymentMethods: { cod_enabled: true } }),
    ).toEqual(["payment_method"]);
  });

  it("returns every unmet requirement together (each independently blocking)", () => {
    expect(
      evaluatePublishRequirements({
        titleAr: "",
        categoryId: null,
        imageCount: 0,
        paymentMethods: {},
      }),
    ).toEqual(["image", "title_ar", "category", "payment_method"]);
  });
});

describe("stripServiceStockFields (R-L09)", () => {
  it("nulls stock + made-to-order for a service", () => {
    expect(stripServiceStockFields("service", { stockQty: 9, isMadeToOrder: true })).toEqual({
      stockQty: null,
      isMadeToOrder: false,
    });
  });

  it("passes products through unchanged", () => {
    expect(stripServiceStockFields("product", { stockQty: 9, isMadeToOrder: true })).toEqual({
      stockQty: 9,
      isMadeToOrder: true,
    });
  });
});

describe("createListingSchema (REG-15 + price/tag rules)", () => {
  const base = {
    type: "product" as const,
    titleAr: "عنوان",
    titleEn: "Title",
    categoryId: CATEGORY,
    priceType: "fixed" as const,
    price: 100,
  };

  it("REG-15: requires BOTH titles", () => {
    expect(createListingSchema.safeParse({ ...base, titleEn: "" }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, titleAr: "" }).success).toBe(false);
    expect(createListingSchema.safeParse(base).success).toBe(true);
  });

  it("requires a price unless price_type is quote_only", () => {
    const { price: _price, ...noPrice } = base;
    void _price;
    expect(createListingSchema.safeParse(noPrice).success).toBe(false);
    expect(
      createListingSchema.safeParse({ ...noPrice, priceType: "quote_only" }).success,
    ).toBe(true);
  });

  it("rejects >5 tags and case-insensitive duplicates", () => {
    expect(
      createListingSchema.safeParse({ ...base, tags: ["a", "b", "c", "d", "e", "f"] }).success,
    ).toBe(false);
    expect(createListingSchema.safeParse({ ...base, tags: ["Cairo", "cairo"] }).success).toBe(
      false,
    );
    expect(createListingSchema.safeParse({ ...base, tags: ["a", "b"] }).success).toBe(true);
  });

  it("rejects a non-positive price (price CHECK > 0)", () => {
    expect(createListingSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, price: -5 }).success).toBe(false);
  });
});

describe("updateStockSchema", () => {
  it("accepts a non-negative integer stock", () => {
    expect(updateStockSchema.safeParse({ listingId: LISTING, stockQty: 0 }).success).toBe(true);
    expect(updateStockSchema.safeParse({ listingId: LISTING, stockQty: 5 }).success).toBe(true);
  });

  it("rejects a negative or non-integer stock (stock_qty CHECK >= 0)", () => {
    expect(updateStockSchema.safeParse({ listingId: LISTING, stockQty: -1 }).success).toBe(false);
    expect(updateStockSchema.safeParse({ listingId: LISTING, stockQty: 1.5 }).success).toBe(false);
  });
});
