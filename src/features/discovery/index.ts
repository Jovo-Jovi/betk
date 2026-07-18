/**
 * Feature: discovery
 * FR IDs:  FR-PUB-1 (Homepage), FR-PUB-2 (Search — T03, not yet built),
 *          FR-PUB-3 (Category Browse), FR-PUB-4 (Listing Detail),
 *          FR-PUB-5 (Public Storefront)
 * UI Spec: §1 Public surfaces (Homepage / Search / Category / Listing / Storefront)
 * Tables:  betk.listings, listing_images, listing_tags, categories, collections,
 *          collection_listings, boosts, stores, seller_profiles,
 *          rating_aggregates, reviews, review_photos
 * Model:   public read-only via the cookie/anon server client — NO service-role,
 *          NO new RLS policies (Phase 03 invariant). See queries/_shared.ts for
 *          the open RLS finding on 5 child tables (no SELECT policy).
 */

// T01 — public read query layer (queries + types only, no UI).
export { getActiveListings } from "./queries/getActiveListings";
export { getCategoryTree } from "./queries/getCategoryTree";
export { getHomepageData } from "./queries/getHomepageData";
export { getListingById } from "./queries/getListingById";
export { getStoreBySlug } from "./queries/getStoreBySlug";
// T03 — search & filter (/search).
export { searchListings } from "./queries/searchListings";
// T04 — category browse (/category/[slug]).
export { getCategoryBySlug } from "./queries/getCategoryBySlug";
// T05 — listing detail (/listing/[id]).
export { getMoreFromStore } from "./queries/getMoreFromStore";

export type {
  CategoryDetail,
  CategoryNode,
  CategorySummary,
  HomepageCollection,
  HomepageData,
  HomepageStrip,
  ListingDetail,
  ListingImage,
  ListingPage,
  ListingReview,
  ListingReviewPhoto,
  ListingSeller,
  ListingSummary,
  SearchListingItem,
  SearchResultPage,
  StoreDetail,
  StoreRatingSummary,
  StoreSummary,
} from "./types";

export {
  getActiveListingsParamsSchema,
  listingSortSchema,
  listingIdSchema,
  storeSlugSchema,
  categorySlugSchema,
  searchListingsParamsSchema,
  searchSortSchema,
  searchListingTypeSchema,
  pickTsConfig,
} from "@/validations/discovery";
export type {
  GetActiveListingsParams,
  ListingSort,
  SearchListingsParams,
  SearchListingsParsedParams,
  SearchSort,
  SearchListingType,
} from "@/validations/discovery";
