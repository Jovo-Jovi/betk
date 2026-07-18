/**
 * getMoreFromStore — "more from this store" rail. Phase 03 / T05 (FR-PUB-4).
 *
 * `listings WHERE store_id = X AND status='active' AND deleted_at IS NULL`,
 * excluding the listing currently being viewed, newest first, capped at
 * `MORE_FROM_STORE_LIMIT`. Reuses `LISTING_SUMMARY_SELECT` (`_shared.ts`),
 * which already forces `stores!inner(...)` — the R-S07 exclusion (T04 STEP 0)
 * holds automatically here too, even though in practice this rail is only
 * ever called with a `storeId` the caller (`getListingById`) already proved
 * is anon-readable (its own `if (!store) return null` guard).
 *
 * Runs under the cookie/anon server client. NO service-role, NO new policy.
 */

import { createClient } from "@/lib/supabase/server";
import type { ListingSummary } from "../types";
import {
  LISTING_SUMMARY_SELECT,
  MORE_FROM_STORE_LIMIT,
  mapListingSummaryRow,
  type DiscoveryClient,
  type RawListingSummaryRow,
} from "./_shared";

/**
 * @param storeId           the listing's owning store (`ListingDetail.storeId`).
 * @param excludeListingId  the listing currently being viewed (never show it in its own rail).
 * @param client             Supabase client override (integration tests inject a plain
 *                           anon client; RSC callers omit this and get the cookie client).
 */
export async function getMoreFromStore(
  storeId: string,
  excludeListingId: string,
  client?: DiscoveryClient,
): Promise<ListingSummary[]> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .select(LISTING_SUMMARY_SELECT)
    .eq("store_id", storeId)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", excludeListingId)
    .order("created_at", { ascending: false })
    .limit(MORE_FROM_STORE_LIMIT);

  if (error) {
    throw new Error(`[discovery] getMoreFromStore failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawListingSummaryRow[];
  return rows.map(mapListingSummaryRow);
}
