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
  sort: listingSortSchema.default("newest"),
  cursor: z.string().min(1).optional(),
});
export type GetActiveListingsParams = z.input<typeof getActiveListingsParamsSchema>;

export const listingIdSchema = z.string().uuid();
export const storeSlugSchema = z.string().trim().min(1).max(80);

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
