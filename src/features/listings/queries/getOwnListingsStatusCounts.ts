/**
 * getOwnListingsStatusCounts — per-status counts for the Listings Management
 * filter tabs (`/seller/listings`, T03). Phase 05 / T03 (FR-SEL-8).
 *
 * Additive sibling to T02's `getOwnListings` — same own-store scope
 * resolution (`resolveCallerStoreId`), no new RLS/migration. Five head-only
 * `count: "exact"` reads (one per concrete status; "all" is their sum) avoid
 * fetching row data just to tally counts. Returns all-zero counts (never
 * throws) when the caller isn't a seller with a store, matching
 * `getOwnListings`'s empty-page behavior for the same case.
 */

import type { ListingStatusFilter } from "@/validations/listings";
import { resolveCallerStoreId, type ListingsClient } from "./_shared";
import { createClient } from "@/lib/supabase/server";

export type OwnListingsStatusCounts = Record<ListingStatusFilter, number>;

const CONCRETE_STATUSES = ["draft", "active", "sold_out", "paused", "removed"] as const;

const ZERO_COUNTS: OwnListingsStatusCounts = {
  all: 0,
  draft: 0,
  active: 0,
  sold_out: 0,
  paused: 0,
  removed: 0,
};

export async function getOwnListingsStatusCounts(
  client?: ListingsClient,
): Promise<OwnListingsStatusCounts> {
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return { ...ZERO_COUNTS };

  const perStatus = await Promise.all(
    CONCRETE_STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .schema("betk")
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("store_id", scope.storeId)
        .eq("status", status);
      if (error) {
        throw new Error(`[listings] getOwnListingsStatusCounts failed: ${error.message}`);
      }
      return { status, count: count ?? 0 };
    }),
  );

  const counts: OwnListingsStatusCounts = { ...ZERO_COUNTS };
  for (const { status, count } of perStatus) {
    counts[status] = count;
  }
  counts.all = CONCRETE_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  return counts;
}
