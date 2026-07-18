/**
 * Discovery feature — typed return shapes for the public read query layer.
 * Phase 03 / T01. Hand-typed (camelCase) wrappers over `Database["betk"]["Tables"]`
 * rows, narrowing JSONB columns via `@/types/jsonb` per BETK_ERD §8.
 */

import type { Database } from "@/lib/supabase/types";
import type { StorePaymentMethods, StoreDeliveryOptions } from "@/types/jsonb";

type E = Database["betk"]["Enums"];

/* ── shared sub-shapes ──────────────────────────────────────────────────── */

export interface StoreRatingSummary {
  averageRating: number;
  totalReviews: number;
  /** rating_N → count, N = 1..5. Null when rating_aggregates is unreadable (RLS finding, see queries/_shared.ts). */
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } | null;
}

export interface StoreSummary {
  id: string;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  avatarUrl: string | null;
  governorate: string;
  city: string | null;
  rating: StoreRatingSummary | null;
}

/* ── getActiveListings / getHomepageData strips ────────────────────────── */

export interface ListingSummary {
  id: string;
  type: E["listing_type"];
  titleAr: string;
  titleEn: string | null;
  price: number | null;
  priceType: E["price_type"];
  status: E["listing_status"];
  stockQty: number | null;
  isMadeToOrder: boolean;
  viewCount: number;
  createdAt: string;
  /** First image by sort_order, or null if unreadable/absent (RLS finding). */
  heroImageUrl: string | null;
  store: StoreSummary | null;
}

export interface ListingPage {
  items: ListingSummary[];
  /** Opaque keyset cursor for the next page, or null when this is the last page. */
  nextCursor: string | null;
}

/* ── searchListings (/search — T03) ─────────────────────────────────────── */

/**
 * A search hit = a listing card plus whether it carries an active boost.
 * `isBoosted` drives both the ListingCard boost ribbon and the R-B04
 * boosted-above-organic ordering (boosted hits are returned first).
 */
export interface SearchListingItem extends ListingSummary {
  isBoosted: boolean;
}

/**
 * One page of search results. Offset-paginated (see searchListings.ts for why
 * keyset isn't used across the boosted/organic tiers). `total` is the full
 * matching count (boosted + organic); `hasMore` reflects whether a further
 * page exists.
 */
export interface SearchResultPage {
  items: SearchListingItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/* ── getCategoryTree ────────────────────────────────────────────────────── */

export interface CategoryNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  iconUrl: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

/* ── getHomepageData ────────────────────────────────────────────────────── */

export interface HomepageCollection {
  id: string;
  nameAr: string;
  nameEn: string | null;
  homepagePosition: number;
  listings: ListingSummary[];
}

/**
 * Each strip resolves (or fails) independently so the homepage can degrade
 * section-by-section (Phase 03 invariant) instead of hard-failing the page.
 */
export interface HomepageStrip<T> {
  status: "ok" | "error";
  data: T | null;
}

export interface HomepageData {
  collections: HomepageStrip<HomepageCollection[]>;
  newArrivals: HomepageStrip<ListingSummary[]>;
  boosted: HomepageStrip<ListingSummary[]>;
}

/* ── getListingById ─────────────────────────────────────────────────────── */

export interface ListingImage {
  url: string;
  sortOrder: number;
}

export interface ListingReviewPhoto {
  url: string;
  sortOrder: number;
}

export interface ListingReview {
  id: string;
  rating: number;
  body: string | null;
  buyerId: string;
  createdAt: string;
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  photos: ListingReviewPhoto[];
}

export interface ListingSeller {
  id: string;
  level: E["seller_level"];
  isVerified: boolean;
  avgResponseHours: number | null;
}

export interface ListingDetail {
  id: string;
  storeId: string;
  categoryId: string;
  subcategoryId: string | null;
  type: E["listing_type"];
  titleAr: string;
  titleEn: string | null;
  descriptionAr: string | null;
  price: number | null;
  priceType: E["price_type"];
  status: E["listing_status"];
  stockQty: number | null;
  lowStockThreshold: number;
  isMadeToOrder: boolean;
  acceptsCustomOrders: boolean;
  customOrderNotes: string | null;
  viewCount: number;
  createdAt: string;
  deliveryOptions: StoreDeliveryOptions;
  images: ListingImage[];
  tags: string[];
  store: StoreSummary;
  seller: ListingSeller | null;
  reviews: ListingReview[];
}

/* ── getStoreBySlug ─────────────────────────────────────────────────────── */

export interface StoreDetail {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  bioAr: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  governorate: string;
  city: string | null;
  returnPolicy: string | null;
  minOrderEgp: number | null;
  paymentMethods: StorePaymentMethods;
  deliveryOptions: StoreDeliveryOptions;
  createdAt: string;
  seller: ListingSeller | null;
  rating: StoreRatingSummary | null;
  listings: ListingSummary[];
  reviews: ListingReview[];
}
