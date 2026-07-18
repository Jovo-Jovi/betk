/**
 * Discovery queries — shared select fragments + row mappers.
 * Phase 03 / T01. Internal module (not re-exported from the feature barrel).
 *
 * NOT SERVER-ONLY: imported by query files that run under both the cookie
 * client (RSC) and a plain anon client (integration tests).
 *
 * ── Catalog public-read RLS (open-issue #14 — RESOLVED 2026-07-01) ──────────
 * `listing_images`, `listing_tags`, `rating_aggregates`, `review_photos`, and
 * `collection_listings` were RLS-ENABLED with ZERO policies (the Phase-01 SQL
 * contract enabled RLS but omitted the CREATE POLICY statements the ERD §3
 * matrix specced). T01-FIX migration `20260701021800_catalog_public_read_rls.sql`
 * added five PERMISSIVE FOR SELECT policies, each parent-scoped to publicly-
 * visible rows only: images/tags via an active+not-deleted listing, review
 * photos via a visible review, collection_listings via a live collection, and
 * rating_aggregates public (pre-aggregated, no PII). The embedded reads below
 * now surface for the anon/authenticated roles; the mapping helpers still
 * degrade gracefully (null/[]) for rows whose parent is not publicly visible.
 *
 * ── R-S07 consistency fix (Phase 03 / T04 STEP 0) ───────────────────────────
 * `LISTING_SUMMARY_SELECT`'s `stores` embed is forced to `stores!inner(...)`,
 * mirroring the pattern `searchListings.ts` (T03) already established. Why:
 * `listings_public` RLS (BETK_DATABASE_SCHEMA.sql) only checks
 * `status='active' AND deleted_at IS NULL` — it does NOT check the owning
 * store's status. A plain (non-inner) `stores(...)` embed just resolves to
 * `null` when the store fails `stores_public` RLS (suspended) — the LISTING
 * ROW ITSELF still comes back (with `store: null` after mapping), so a
 * suspended store's active listing would leak into `getActiveListings` /
 * `getHomepageData` (both consume this constant). `stores!inner` makes the
 * store an INNER join, so the whole listing row is dropped whenever its store
 * isn't anon-readable — exactly R-S07's intent (BETK_ERD.md line 86:
 * "suspended sellers/stores/listings are hidden via status filters (R-S07)").
 * Verified LIVE (staging, seeded+cleaned): before this fix, an active listing
 * under a `suspended`-status store surfaced in both `getActiveListings` and
 * `getHomepageData` (newArrivals + boosted strips); after, it's excluded from
 * all three — see `tests/integration/discovery.category.test.ts`.
 * `getStoreBySlug` also consumes this constant but is unaffected in practice
 * (it only ever queries a store already resolved as `status='active'`, so the
 * added inner-join condition is always already satisfied there).
 * `getListingById` uses its OWN separate `LISTING_DETAIL_SELECT` (not this
 * constant) and is NOT touched here — see that file's header for why it
 * already doesn't leak (verified, not fixed) — flagged for T05, which owns
 * `/listing/[id]`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ListingSort, ListingCursor } from "@/validations/discovery";
import type {
  ListingReview,
  ListingSeller,
  ListingSummary,
  StoreRatingSummary,
  StoreSummary,
} from "../types";

type ListingRow = Database["betk"]["Tables"]["listings"]["Row"];
type SellerLevel = Database["betk"]["Enums"]["seller_level"];

export const LISTINGS_PAGE_SIZE = 24;
export const HOMEPAGE_STRIP_LIMIT = 12;
/** Recent visible reviews shown on a listing/storefront page (not paginated in T01). */
export const RECENT_REVIEWS_LIMIT = 10;

/**
 * Minimal client shape every discovery query depends on (`.schema("betk")`).
 * Deliberately narrower than `SupabaseClient<Database>` — the cookie-bound
 * RSC client (`@supabase/ssr` `createServerClient`) and the plain anon client
 * integration tests inject (`@supabase/supabase-js` `createClient`) resolve to
 * structurally distinct generic instantiations (the `ssr` client adds an
 * internal `__InternalSupabase` schema slot) that TS otherwise refuses to
 * unify. `.schema()`'s own generic is independent of that mismatch, so this
 * `Pick` accepts both real callers without `any`.
 */
export type DiscoveryClient = Pick<SupabaseClient<Database>, "schema">;

/** Column actually ordered/filtered for each public listing sort. */
export const LISTING_SORT_COLUMN: Record<ListingSort, "created_at" | "view_count"> = {
  newest: "created_at",
  popular: "view_count",
};

/**
 * Select fragment for a listing "card" (grids, strips, storefront tab).
 * Embeds the hero-candidate images + the owning store + its rating aggregate.
 */
export const LISTING_SUMMARY_SELECT = `
  id, store_id, category_id, subcategory_id, type, title_ar, title_en,
  price, price_type, status, stock_qty, is_made_to_order, view_count, created_at,
  listing_images ( url, sort_order ),
  stores!inner ( id, name_ar, name_en, slug, avatar_url, governorate, city,
    rating_aggregates ( average_rating, total_reviews, rating_1, rating_2, rating_3, rating_4, rating_5 ) )
`;

/* ── Raw row shapes returned by the select above ──────────────────────────
 * Hand-typed: a dynamic select-string embed isn't statically inferred by
 * supabase-js, so we type the expected shape explicitly and cast at the call
 * site (`as unknown as RawListingSummaryRow[]`). Embedded one-to-one
 * relations may surface as a bare object OR a 1-element array depending on
 * the PostgREST version's FK-direction inference — `asSingle()` normalises
 * both.
 */
export interface RawListingImage {
  url: string;
  sort_order: number;
}

export interface RawRatingAggregate {
  average_rating: number;
  total_reviews: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
}

export interface RawStoreSummary {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  avatar_url: string | null;
  governorate: string;
  city: string | null;
  rating_aggregates: RawRatingAggregate | RawRatingAggregate[] | null;
}

export interface RawListingSummaryRow {
  id: string;
  store_id: string;
  category_id: string;
  subcategory_id: string | null;
  type: ListingRow["type"];
  title_ar: string;
  title_en: string | null;
  price: number | null;
  price_type: ListingRow["price_type"];
  status: ListingRow["status"];
  stock_qty: number | null;
  is_made_to_order: boolean;
  view_count: number;
  created_at: string;
  listing_images: RawListingImage[] | null;
  stores: RawStoreSummary | RawStoreSummary[] | null;
}

/** Normalises a to-one embed that PostgREST may return as object OR [object]. */
export function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Hero image = sort_order 0; falls back to the lowest sort_order present. */
export function pickHeroImageUrl(images: RawListingImage[] | null | undefined): string | null {
  const list = images ?? [];
  if (list.length === 0) return null;
  const zero = list.find((img) => img.sort_order === 0);
  if (zero) return zero.url;
  return [...list].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

export function mapRatingAggregate(
  raw: RawRatingAggregate | null | undefined,
): StoreRatingSummary | null {
  if (!raw) return null;
  return {
    averageRating: raw.average_rating,
    totalReviews: raw.total_reviews,
    distribution: {
      1: raw.rating_1,
      2: raw.rating_2,
      3: raw.rating_3,
      4: raw.rating_4,
      5: raw.rating_5,
    },
  };
}

export function mapStoreSummary(raw: RawStoreSummary | null | undefined): StoreSummary | null {
  if (!raw) return null;
  return {
    id: raw.id,
    nameAr: raw.name_ar,
    nameEn: raw.name_en,
    slug: raw.slug,
    avatarUrl: raw.avatar_url,
    governorate: raw.governorate,
    city: raw.city,
    rating: mapRatingAggregate(asSingle(raw.rating_aggregates)),
  };
}

export function mapListingSummaryRow(row: RawListingSummaryRow): ListingSummary {
  return {
    id: row.id,
    type: row.type,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    price: row.price,
    priceType: row.price_type,
    status: row.status,
    stockQty: row.stock_qty,
    isMadeToOrder: row.is_made_to_order,
    viewCount: row.view_count,
    createdAt: row.created_at,
    heroImageUrl: pickHeroImageUrl(row.listing_images),
    store: mapStoreSummary(asSingle(row.stores)),
  };
}

/* ── Seller profile (listing detail / storefront) ─────────────────────────── */

export interface RawSellerProfile {
  id: string;
  level: SellerLevel;
  is_verified: boolean;
  avg_response_hours: number | null;
}

export function mapSellerProfile(raw: RawSellerProfile | null | undefined): ListingSeller | null {
  if (!raw) return null;
  return {
    id: raw.id,
    level: raw.level,
    isVerified: raw.is_verified,
    avgResponseHours: raw.avg_response_hours,
  };
}

/* ── Visible reviews (listing detail / storefront) ────────────────────────
 * `reviews` has a public policy (`reviews_public: is_visible = true OR
 * buyer_id = auth.uid() OR is_admin()`), so this query works for anon. The
 * nested `review_photos` embed now has `review_photos_public` (visible via a
 * visible review), so photos surface for visible reviews and stay hidden for
 * hidden ones.
 */

export interface RawReviewPhoto {
  url: string;
  sort_order: number;
}

export interface RawReviewRow {
  id: string;
  rating: number;
  body: string | null;
  buyer_id: string;
  created_at: string;
  seller_reply: string | null;
  seller_replied_at: string | null;
  review_photos: RawReviewPhoto[] | null;
}

const REVIEW_SELECT = `
  id, rating, body, buyer_id, created_at, seller_reply, seller_replied_at,
  review_photos ( url, sort_order )
`;

function mapReviewRow(row: RawReviewRow): ListingReview {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    buyerId: row.buyer_id,
    createdAt: row.created_at,
    sellerReply: row.seller_reply,
    sellerRepliedAt: row.seller_replied_at,
    photos: (row.review_photos ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ url: p.url, sortOrder: p.sort_order })),
  };
}

/**
 * Fetches the most recent visible reviews for a store (reviews are
 * order/store-scoped, not listing-scoped — BETK has no `reviews.listing_id`;
 * the listing detail page shows the seller's store-level reviews, per ERD §3).
 */
export async function fetchVisibleReviewsByStore(
  supabase: DiscoveryClient,
  storeId: string,
): Promise<ListingReview[]> {
  const { data, error } = await supabase
    .schema("betk")
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("store_id", storeId)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(RECENT_REVIEWS_LIMIT);

  if (error) {
    throw new Error(`[discovery] fetchVisibleReviewsByStore failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawReviewRow[];
  return rows.map(mapReviewRow);
}

/**
 * Builds the PostgREST `.or(...)` keyset predicate for "rows strictly after
 * this cursor" given the sort's column. Tiebreaks on `id DESC` so rows
 * sharing the same sort value (e.g. two listings created in the same
 * millisecond) still paginate deterministically.
 */
export function listingCursorPredicate(sort: ListingSort, cursor: ListingCursor): string {
  const column = LISTING_SORT_COLUMN[sort];
  return `${column}.lt.${cursor.v},and(${column}.eq.${cursor.v},id.lt.${cursor.id})`;
}

/** Builds the next-page cursor from the last row of a fetched (full) page. */
export function nextCursorFromRow(
  sort: ListingSort,
  row: { created_at: string; view_count: number; id: string },
): ListingCursor {
  const column = LISTING_SORT_COLUMN[sort];
  const v = column === "view_count" ? String(row.view_count) : row.created_at;
  return { v, id: row.id };
}
