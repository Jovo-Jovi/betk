/**
 * Homepage featured-store row mapper (D2, REG-111).
 * Localized name, locale-aware href, hideFollow, no listing count.
 */

import { describe, expect, it } from "vitest";
import {
  mapFeaturedStore,
  type RawFeaturedStoreRow,
} from "@/features/discovery/queries/mapFeaturedStore";

function row(overrides: Partial<RawFeaturedStoreRow> = {}): RawFeaturedStoreRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "north-shop",
    name_ar: "متجر الشمال",
    name_en: "North Shop",
    avatar_url: "https://cdn.example/avatar.png",
    cover_url: "https://cdn.example/cover.png",
    governorate: "cairo",
    created_at: "2026-10-05T00:00:00.000Z",
    rating_aggregates: { average_rating: 4.5, total_reviews: 12 },
    seller_profiles: { level: "gold", is_verified: true },
    ...overrides,
  };
}

describe("mapFeaturedStore", () => {
  it("uses the Arabic name and an unprefixed store href for ar", () => {
    const card = mapFeaturedStore(row(), "ar");
    expect(card.name).toBe("متجر الشمال");
    expect(card.storeHref).toBe("/store/north-shop");
    expect(card.governorate).toBe("القاهرة");
  });

  it("uses the English name and an /en href for en, and falls back to Arabic when name_en is absent", () => {
    const card = mapFeaturedStore(row(), "en");
    expect(card.name).toBe("North Shop");
    expect(card.storeHref).toBe("/en/store/north-shop");
    expect(card.governorate).toBe("Cairo");

    const fallback = mapFeaturedStore(row({ name_en: null }), "en");
    expect(fallback.name).toBe("متجر الشمال");
  });

  it("sets hideFollow and carries no listing count", () => {
    const card = mapFeaturedStore(row(), "ar");
    expect(card.hideFollow).toBe(true);
    expect(card).not.toHaveProperty("listingCount");
    expect(card.avatar).toBe("https://cdn.example/avatar.png");
    expect(card.cover).toBe("https://cdn.example/cover.png");
    expect(card.level).toBe("gold");
    expect(card.verified).toBe(true);
    expect(card.rating).toBe(4.5);
    expect(card.reviews).toBe(12);
  });

  it("omits a missing avatar, cover, and rating", () => {
    const card = mapFeaturedStore(
      row({ avatar_url: null, cover_url: null, rating_aggregates: null, seller_profiles: null }),
      "ar",
    );
    expect(card.avatar).toBeUndefined();
    expect(card.cover).toBeUndefined();
    expect(card.rating).toBeUndefined();
    expect(card.reviews).toBeUndefined();
    expect(card.level).toBeUndefined();
    expect(card.verified).toBe(false);
    expect(card).not.toHaveProperty("listingCount");
  });
});
