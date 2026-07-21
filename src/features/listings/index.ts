/**
 * Feature: listings (seller-side write layer + read queries) — Phase 05.
 * FR IDs:  FR-SEL-8 (Listings Management), FR-SEL-9 (Create/Edit Listing),
 *          FR-SEL-10 (Stock & Inventory)
 * UI Spec: §5.8–5.10 Listings — manage, create, edit, inventory
 * Tables:  betk.listings, listing_images, listing_tags, categories, stores
 * Model:   seller-side writes under the cookie client (RLS listings_seller +
 *          listing_images_seller / listing_tags_seller [T01/REG-34] + a
 *          server-verified own-store pin). NO service-role. NO new RLS/migration
 *          (ADR-013 draft-first decomposition — no rpc needed). OD-1 low-stock
 *          is DERIVED (no inventory_alerts table).
 *
 * REG-15 (bilingual title) schema-half closed here: title_ar + title_en BOTH
 * required at the Zod layer (`@/validations/listings`); title_en nullable in DB.
 */

// ── T02 queries (seller-side reads) ─────────────────────────────────────────
export { getOwnListings } from "./queries/getOwnListings";
export { getOwnListingById } from "./queries/getOwnListingById";
export { getOwnInventory } from "./queries/getOwnInventory";

// ── T02 Server Actions (write layer) ────────────────────────────────────────
export { createListing } from "./actions/createListing";
export { updateListing } from "./actions/updateListing";
export { publishListing } from "./actions/publishListing";
export { pauseListing, unpauseListing } from "./actions/pauseListing";
export { softDeleteListing } from "./actions/softDeleteListing";
export { updateStock } from "./actions/updateStock";
export {
  addListingImage,
  removeListingImage,
  reorderListingImages,
} from "./actions/manageListingImages";

// ── Pure rules (unit-tested) ────────────────────────────────────────────────
export {
  evaluatePublishRequirements,
  hasPaymentMethod,
  ownsMediaPrefix,
  mediaObjectPathFromPublicUrl,
  stripServiceStockFields,
  type PublishRequirement,
} from "./listingRules";

// ── Return shapes ───────────────────────────────────────────────────────────
export type {
  OwnListingRow,
  OwnListingsPage,
  OwnListingDetail,
  OwnInventoryItem,
} from "./types";

// ── Schemas + discriminated result types ────────────────────────────────────
export {
  createListingSchema,
  updateListingSchema,
  addListingImageSchema,
  removeListingImageSchema,
  reorderListingImagesSchema,
  listingIdInputSchema,
  updateStockSchema,
  getOwnListingsParamsSchema,
  listingStatusFilterSchema,
  listingTypeSchema,
  priceTypeSchema,
} from "@/validations/listings";
export type {
  CreateListingInput,
  UpdateListingInput,
  AddListingImageInput,
  RemoveListingImageInput,
  ReorderListingImagesInput,
  ListingIdInput,
  UpdateStockInput,
  GetOwnListingsParams,
  ListingStatusFilter,
  CreateListingResult,
  UpdateListingResult,
  PublishListingResult,
  SetPauseResult,
  SoftDeleteListingResult,
  UpdateStockResult,
  AddListingImageResult,
  RemoveListingImageResult,
  ReorderListingImagesResult,
} from "@/validations/listings";
