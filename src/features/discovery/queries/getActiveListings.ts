/**
 * getActiveListings — public listing grid query. Phase 03 / T01 (FR-PUB-1/3),
 * category filter updated at T04.
 *
 * `status='active' AND deleted_at IS NULL` (the ONLY rows `listings_public`
 * RLS exposes to anon/non-owner readers — BETK_DATABASE_SCHEMA.sql), keyset
 * cursor-paginated on `created_at` (default) or `view_count` (sort="popular"),
 * optionally filtered to a category. Runs under the cookie/anon server client
 * — NEVER the service-role client (no RLS bypass for a public surface).
 *
 * ── Category filter (T04, BETK_UI_SPEC.md §3 Category Browse, line 97) ─────
 * "listings where `category_id` OR `subcategory_id` matches" the resolved
 * category — NOT a recursive descendant-subtree traversal. The schema only
 * carries two listing-side category levels (`category_id` top-level,
 * required; `subcategory_id` one level below, optional), so a single
 * `category_id.eq.X,subcategory_id.eq.X` OR-predicate already satisfies the
 * spec exactly, whether the resolved category (by slug, T04) is itself a
 * top-level category or a subcategory — no recursion needed.
 *
 * ── Suspended-store exclusion (R-S07, T04 STEP 0) ──────────────────────────
 * The `stores` embed in `LISTING_SUMMARY_SELECT` (`_shared.ts`) is forced to
 * `stores!inner(...)`, so a listing whose store fails `stores_public` RLS
 * (suspended) is dropped from the result set entirely, not just shown with a
 * null store. See `_shared.ts`'s header for the full R-S07 fix rationale.
 *
 * See `_shared.ts` for the RLS finding on `listing_images`/`rating_aggregates`
 * (no SELECT policy → hero image / store rating come back null, not an error).
 */

import { createClient } from "@/lib/supabase/server";
import {
  getActiveListingsParamsSchema,
  decodeListingCursor,
  encodeListingCursor,
  type GetActiveListingsParams,
} from "@/validations/discovery";
import type { ListingPage } from "../types";
import {
  LISTING_SORT_COLUMN,
  LISTINGS_PAGE_SIZE,
  LISTING_SUMMARY_SELECT,
  listingCursorPredicate,
  mapListingSummaryRow,
  nextCursorFromRow,
  type DiscoveryClient,
  type RawListingSummaryRow,
} from "./_shared";

/**
 * @param params  category (UUID; matches a listing's `category_id` OR
 *                `subcategory_id` — see the file header), store (UUID; scopes
 *                the grid to a single store's listings — storefront Listings
 *                tab, T06), sort ("newest" default | "popular"), and an opaque
 *                cursor from a previous page's `nextCursor`.
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function getActiveListings(
  params: GetActiveListingsParams = {},
  client?: DiscoveryClient,
): Promise<ListingPage> {
  const parsed = getActiveListingsParamsSchema.parse(params);
  const cursor = decodeListingCursor(parsed.cursor);
  const supabase = client ?? (await createClient());

  let query = supabase
    .schema("betk")
    .from("listings")
    .select(LISTING_SUMMARY_SELECT)
    .eq("status", "active")
    .is("deleted_at", null);

  if (parsed.category) {
    query = query.or(`category_id.eq.${parsed.category},subcategory_id.eq.${parsed.category}`);
  }
  if (parsed.store) {
    query = query.eq("store_id", parsed.store);
  }
  if (cursor) {
    query = query.or(listingCursorPredicate(parsed.sort, cursor));
  }

  const sortColumn = LISTING_SORT_COLUMN[parsed.sort];
  const { data, error } = await query
    .order(sortColumn, { ascending: false })
    .order("id", { ascending: false })
    .limit(LISTINGS_PAGE_SIZE);

  if (error) {
    throw new Error(`[discovery] getActiveListings failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawListingSummaryRow[];
  const items = rows.map(mapListingSummaryRow);

  const nextCursor =
    rows.length === LISTINGS_PAGE_SIZE
      ? encodeListingCursor(nextCursorFromRow(parsed.sort, rows[rows.length - 1]!))
      : null;

  return { items, nextCursor };
}
