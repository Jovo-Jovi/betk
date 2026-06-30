/**
 * getActiveListings — public listing grid query. Phase 03 / T01 (FR-PUB-1/3).
 *
 * `status='active' AND deleted_at IS NULL` (the ONLY rows `listings_public`
 * RLS exposes to anon/non-owner readers — BETK_DATABASE_SCHEMA.sql), keyset
 * cursor-paginated on `created_at` (default) or `view_count` (sort="popular"),
 * optionally filtered to a category. Runs under the cookie/anon server client
 * — NEVER the service-role client (no RLS bypass for a public surface).
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
 * @param params  category (UUID, top-level `listings.category_id`), sort
 *                ("newest" default | "popular"), and an opaque cursor from a
 *                previous page's `nextCursor`.
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
    query = query.eq("category_id", parsed.category);
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
