/**
 * Discovery query-input schemas (Zod) — Phase 03 / T01.
 *
 * These queries are NOT Server Actions (no `check-zod-coverage` requirement),
 * but params will eventually be sourced from public URL search params
 * (`/`, `/category/[slug]`, future `/search`), so they are validated
 * defensively before touching the DB regardless.
 *
 * Cursor scheme: opaque base64url-encoded JSON `{ v, id }` keyset cursor —
 *   v  = the sort column's value at the last row of the previous page
 *        (ISO timestamp string for "newest", stringified integer for "popular")
 *   id = that row's listing id (tiebreaker for rows sharing the same `v`)
 * Callers must treat the string as opaque; only this module encodes/decodes it.
 */

import { z } from "zod";

/** Mirrors the two partial indexes available for listing ordering (BETK_ERD §4). */
export const listingSortSchema = z.enum(["newest", "popular"]);
export type ListingSort = z.infer<typeof listingSortSchema>;

export const listingCursorSchema = z.object({
  v: z.string().min(1),
  id: z.string().uuid(),
});
export type ListingCursor = z.infer<typeof listingCursorSchema>;

export const getActiveListingsParamsSchema = z.object({
  category: z.string().uuid().optional(),
  /** Scope the grid to a single store (storefront Listings tab, T06). */
  store: z.string().uuid().optional(),
  sort: listingSortSchema.default("newest"),
  cursor: z.string().min(1).optional(),
});
export type GetActiveListingsParams = z.input<typeof getActiveListingsParamsSchema>;

export const listingIdSchema = z.string().uuid();
export const storeSlugSchema = z.string().trim().min(1).max(80);
export const categorySlugSchema = z.string().trim().min(1).max(80);

/* ── Wishlist / follow Server Action inputs (Phase 03 / T06) ────────────────
 * The two auth-gated write actions validate their single id argument with Zod
 * before any DB call (CI check-zod-coverage). The authenticated buyer_id is
 * ALWAYS read from the live GoTrue session inside the action — never accepted
 * from the client — so only the target id needs validating here.
 */
export const toggleWishlistInputSchema = z.object({
  listingId: z.string().uuid(),
});
export type ToggleWishlistInput = z.infer<typeof toggleWishlistInputSchema>;

export const toggleFollowInputSchema = z.object({
  storeId: z.string().uuid(),
});
export type ToggleFollowInput = z.infer<typeof toggleFollowInputSchema>;

/**
 * Shared discriminated result for both discovery toggle actions
 * (`toggleWishlist` / `toggleFollow`). Lives here (not in a `"use server"`
 * action file, which may only export async functions) so both actions and
 * their client consumers can import it. `active` = the NEW state (for optimistic
 * UI reconciliation); `reason: "unauthenticated"` → client routes to login.
 */
export type ToggleResult =
  | { ok: true; active: boolean }
  | { ok: false; reason: "unauthenticated" | "invalid" | "error" };

/* ── Search (/search) — Phase 03 / T03 (FR-PUB-2) ──────────────────────────
 * Params are sourced from PUBLIC, locale-neutral URL search params (same URL
 * shape under /en). Everything arrives as a string (or absent), so each field
 * is preprocessed empty→undefined and coerced before validation. Invalid
 * params never throw at the page — `safeParse` + defaults degrade to "no
 * filter" rather than 500 (a tampered/stale shareable URL must still render).
 */

/** "" / null → undefined, so `.optional()`/`.default()` engage cleanly. */
const emptyToUndefined = (v: unknown): unknown =>
  v === "" || v === null ? undefined : v;

/** Sort modes offered by the sort control (BETK_UI_SPEC §Search). */
export const searchSortSchema = z.enum(["relevance", "newest", "price", "popularity"]);
export type SearchSort = z.infer<typeof searchSortSchema>;

/** Listing-type filter (product|service); absent = both. */
export const searchListingTypeSchema = z.enum(["product", "service"]);
export type SearchListingType = z.infer<typeof searchListingTypeSchema>;

export const searchListingsParamsSchema = z.object({
  /** 1–2 keyword full-text query over listings.search_vector (C2). */
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  category: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  type: z.preprocess(emptyToUndefined, searchListingTypeSchema.optional()),
  /** stores.governorate slug (e.g. "cairo"). */
  governorate: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()),
  /** stores.city free-text (exact match). */
  city: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
  priceMin: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  priceMax: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  sort: z.preprocess(emptyToUndefined, searchSortSchema.default("relevance")),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
});
export type SearchListingsParams = z.input<typeof searchListingsParamsSchema>;
export type SearchListingsParsedParams = z.infer<typeof searchListingsParamsSchema>;

/**
 * Pick the text-search config from the query's script. The
 * `update_listing_search_vector` trigger builds the vector with the `'arabic'`
 * config for `title_ar` (weight A) and the `'english'` config for
 * `title_en`/`description_ar` (weights B/C) — NOT `unaccent` (verified live,
 * OD-7 §7 carry). The `'arabic'` config's normaliser folds Arabic diacritics,
 * so an Arabic query matches diacritic and non-diacritic titles both ways
 * WITHOUT unaccent; the `'english'` snowball stemmer is what matches the
 * English-stemmed lexemes. A single `websearch_to_tsquery` call takes ONE
 * config, so we route by script: any Arabic codepoint → 'arabic', else
 * 'english'. (BETK is Arabic-first; title_ar is the primary/weight-A field.)
 */
export function pickTsConfig(query: string): "arabic" | "english" {
  return /[\u0600-\u06FF]/.test(query) ? "arabic" : "english";
}

/**
 * Encode a keyset cursor for the next page.
 */
export function encodeListingCursor(cursor: ListingCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/**
 * Decode + validate an opaque cursor string. Returns null on any malformed
 * input (treated as "no cursor" / first page) rather than throwing — a
 * tampered or stale cursor should degrade to page 1, not 500.
 */
export function decodeListingCursor(raw: string | undefined): ListingCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = listingCursorSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
