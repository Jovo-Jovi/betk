/**
 * Listing write-layer schemas (Zod) — Phase 05 / T02 (FR-SEL-8..10).
 *
 * Every `src/features/listings` Server Action validates its input against one
 * of these BEFORE any DB call (CI `check-zod-coverage`). Shapes mirror the DB
 * columns (BETK_DATABASE_SCHEMA `betk.listings` / `listing_images` /
 * `listing_tags`) and the typed JSONB in `@/types/jsonb`.
 *
 * REG-15 (bilingual title) — CLOSED at the schema layer HERE: `titleAr` AND
 * `titleEn` are BOTH required (min 1) on create/edit. `listings.title_en` stays
 * NULLABLE in the DB (no schema change); the requirement lives only at this
 * form/validation layer. The T04 create/edit form mirrors this schema via
 * `.pick(...)` so there is a single source of truth. (T02 closes the schema
 * half; T04 closes the form half — see the Phase-05 pack REG-15 line.)
 *
 * Result types live here (not in the `"use server"` action files, which may
 * only export async functions) so each action and its T03/T04/T05 client
 * consumer share the discriminated union.
 *
 * DB constraints that stay AUTHORITATIVE (Zod pre-validates; the DB error is
 * the final word):
 *   • chk_listing_price   — price_type='quote_only' OR price IS NOT NULL
 *   • price CHECK > 0, stock_qty CHECK >= 0
 *   • chk_listing_img_order — sort_order BETWEEN 0 AND 4 (≤5 images)
 *   • uq_listing_tag       — UNIQUE (listing_id, tag) (tag uniqueness)
 * Tags ≤5 is NOT a DB constraint (no count check) → APP-enforced here (.max(5));
 * tag uniqueness IS a DB constraint (uq_listing_tag) → the app pre-checks for a
 * friendly error, the 23505 is authoritative.
 */

import { z } from "zod";
import { storeDeliveryOptionsSchema } from "@/validations/sellerOnboarding";
import type { PublishRequirement } from "@/features/listings/listingRules";

/** NUMERIC(10,2): ≤ 99,999,999.99 and > 0 (price CHECK). */
const priceSchema = z.number().positive().max(99_999_999.99);
/** INTEGER, CHECK >= 0. */
const stockQtySchema = z.number().int().min(0).max(1_000_000);
/** SMALLINT low_stock_threshold (NOT NULL DEFAULT 3). */
const lowStockThresholdSchema = z.number().int().min(0).max(32_767);

export const listingTypeSchema = z.enum(["product", "service"]);
export const priceTypeSchema = z.enum(["fixed", "per_hour", "starting_from", "quote_only"]);

/** VARCHAR(30) tag; ≤5 unique per listing (uniqueness is DB-authoritative). */
export const listingTagSchema = z.string().trim().min(1).max(30);

/** The editable listing content fields shared by create + update. */
const listingContentShape = {
  type: listingTypeSchema,
  // REG-15: BOTH titles required at the form/Zod layer (title_en nullable in DB).
  titleAr: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().min(1).max(80),
  descriptionAr: z.string().trim().max(5000).optional(),
  categoryId: z.string().uuid(), // R-L01 / R-L04
  subcategoryId: z.string().uuid().optional(),
  priceType: priceTypeSchema,
  price: priceSchema.optional(), // required unless quote_only (superRefine below)
  stockQty: stockQtySchema.optional(),
  isMadeToOrder: z.boolean().optional(),
  lowStockThreshold: lowStockThresholdSchema.optional(),
  acceptsCustomOrders: z.boolean().optional(),
  customOrderNotes: z.string().trim().max(2000).optional(),
  deliveryOptions: storeDeliveryOptionsSchema.optional(),
  tags: z.array(listingTagSchema).max(5).optional(),
} as const;

/** Shared cross-field validation for create + update. */
function refineListingContent(
  val: { priceType: string; price?: number; tags?: string[] },
  ctx: z.RefinementCtx,
): void {
  // chk_listing_price: a non-quote_only listing must carry a price.
  if (val.priceType !== "quote_only" && (val.price === undefined || val.price === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "price_required" });
  }
  // Tag uniqueness pre-check (uq_listing_tag is authoritative). Case-insensitive
  // dedup so "Cairo"/"cairo" don't both slip past into a 23505 at write time.
  if (val.tags && val.tags.length > 0) {
    const norm = val.tags.map((t) => t.trim().toLowerCase());
    if (new Set(norm).size !== norm.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tags"], message: "tags_duplicate" });
    }
  }
}

export const createListingSchema = z.object(listingContentShape).superRefine(refineListingContent);

export const updateListingSchema = z
  .object({ listingId: z.string().uuid(), ...listingContentShape })
  .superRefine(refineListingContent);

export type CreateListingInput = z.input<typeof createListingSchema>;
export type CreateListingParsed = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.input<typeof updateListingSchema>;
export type UpdateListingParsed = z.infer<typeof updateListingSchema>;

/* ── Image management ─────────────────────────────────────────────────────
 * The client uploads the image to the PUBLIC media bucket under its OWN prefix
 * (T01-Phase-04 contract) and passes the resulting public URL. The action
 * re-checks own-prefix ownership server-side (ownsMediaPrefix). sort_order is
 * 0..4 (chk_listing_img_order); hero = 0. ≤5 images is enforced app-side
 * against the current row count (there is no DB count constraint, only the
 * per-row 0..4 range).
 */
export const addListingImageSchema = z.object({
  listingId: z.string().uuid(),
  url: z.string().trim().url().max(2000),
  sortOrder: z.number().int().min(0).max(4),
});

export const removeListingImageSchema = z.object({
  imageId: z.string().uuid(),
});

/** Ordered image ids → sort_order = array index (≤5, hero = index 0). */
export const reorderListingImagesSchema = z.object({
  listingId: z.string().uuid(),
  imageIds: z.array(z.string().uuid()).min(1).max(5),
});

export type AddListingImageInput = z.input<typeof addListingImageSchema>;
export type RemoveListingImageInput = z.input<typeof removeListingImageSchema>;
export type ReorderListingImagesInput = z.input<typeof reorderListingImagesSchema>;

/* ── Status transitions ──────────────────────────────────────────────────── */

export const listingIdInputSchema = z.object({ listingId: z.string().uuid() });
export type ListingIdInput = z.input<typeof listingIdInputSchema>;

/** updateStock (T05 consumer). Sets stock_qty; R-L07 restock flip is derived. */
export const updateStockSchema = z.object({
  listingId: z.string().uuid(),
  stockQty: stockQtySchema,
});
export type UpdateStockInput = z.input<typeof updateStockSchema>;

/* ── Query params ──────────────────────────────────────────────────────────
 * getOwnListings status filter (the T03 tabs) + offset pagination.
 */
export const listingStatusFilterSchema = z.enum([
  "all",
  "draft",
  "active",
  "sold_out",
  "paused",
  "removed",
]);
export type ListingStatusFilter = z.infer<typeof listingStatusFilterSchema>;

export const getOwnListingsParamsSchema = z.object({
  status: listingStatusFilterSchema.default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});
export type GetOwnListingsParams = z.input<typeof getOwnListingsParamsSchema>;
export type GetOwnListingsParsedParams = z.infer<typeof getOwnListingsParamsSchema>;

/* ── Discriminated results ─────────────────────────────────────────────────
 * Every action NEVER throws to the client — it returns one of these unions.
 * Shared reasons across the mutating actions:
 *   unauthenticated → /auth/login · blocked → /blocked (R-A05) · no_store → the
 *   caller isn't a seller with a store · not_found → the listing isn't the
 *   caller's (RLS/own-store scope) · invalid → Zod / bad input · error → generic.
 */
type BaseFailReason =
  | "unauthenticated"
  | "blocked"
  | "no_store"
  | "not_found"
  | "invalid"
  | "error";

export type CreateListingResult =
  | { ok: true; listingId: string }
  | { ok: false; reason: Exclude<BaseFailReason, "not_found"> };

export type UpdateListingResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason };

/** publishListing — a blocked publish returns the UNMET requirements checklist. */
export type PublishListingResult =
  | { ok: true }
  | { ok: false; reason: "unmet_requirements"; unmet: PublishRequirement[] }
  | { ok: false; reason: BaseFailReason | "invalid_state" };

export type SetPauseResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason | "invalid_state" };

export type SoftDeleteListingResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason };

/** updateStock — `restocked` true when a sold_out listing was flipped to active (R-L07). */
export type UpdateStockResult =
  | { ok: true; restocked: boolean }
  | { ok: false; reason: BaseFailReason };

export type AddListingImageResult =
  | { ok: true; imageId: string }
  | { ok: false; reason: BaseFailReason | "limit_reached" | "forbidden_path" };

export type RemoveListingImageResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason };

export type ReorderListingImagesResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason };
