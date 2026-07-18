/**
 * getHomepageData — homepage strips. Phase 03 / T01 (FR-PUB-1).
 *
 * Three independently-fetched strips (live collections, new arrivals, boosted)
 * so the homepage (T02) can degrade section-by-section: a failed/empty strip
 * never blocks the others. Each strip catches its own error and resolves to
 * `{ status: "error", data: null }` rather than rejecting the whole call.
 *
 * Runs under the cookie/anon server client. See `_shared.ts` for the
 * `collection_listings` RLS finding — the collections strip will currently
 * resolve to `{ status: "ok", data: [] }` (zero rows, not an error) on every
 * live collection until that table's missing SELECT policy is addressed.
 *
 * ── R-S07 fix (Phase 03 / T04 STEP 0) ────────────────────────────────────────
 * All three strips (collections, new arrivals, boosted) select listings via
 * `LISTING_SUMMARY_SELECT` — its `stores!inner(...)` embed (see `_shared.ts`)
 * now excludes a listing whose owning store is suspended, closing an R-S07
 * leak verified live on this exact function before the fix (an active listing
 * under a `suspended` store surfaced in `newArrivals` and `boosted`).
 */

import { createClient } from "@/lib/supabase/server";
import type { HomepageCollection, HomepageData, HomepageStrip, ListingSummary } from "../types";
import {
  HOMEPAGE_STRIP_LIMIT,
  LISTING_SUMMARY_SELECT,
  asSingle,
  mapListingSummaryRow,
  type DiscoveryClient,
  type RawListingSummaryRow,
} from "./_shared";

type BetkClient = DiscoveryClient;

const COLLECTIONS_SELECT = `
  id, name_ar, name_en, homepage_position,
  collection_listings (
    sort_order,
    listings ( ${LISTING_SUMMARY_SELECT} )
  )
`;

interface RawCollectionListing {
  sort_order: number;
  listings: RawListingSummaryRow | RawListingSummaryRow[] | null;
}
interface RawCollectionRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  homepage_position: number;
  collection_listings: RawCollectionListing[] | null;
}

function mapCollectionRow(row: RawCollectionRow): HomepageCollection {
  const listings = (row.collection_listings ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cl) => asSingle(cl.listings))
    .filter((l): l is RawListingSummaryRow => l !== null)
    .map(mapListingSummaryRow);

  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    homepagePosition: row.homepage_position,
    listings,
  };
}

async function fetchCollectionsStrip(
  supabase: BetkClient,
): Promise<HomepageStrip<HomepageCollection[]>> {
  try {
    const { data, error } = await supabase
      .schema("betk")
      .from("collections")
      .select(COLLECTIONS_SELECT)
      .eq("status", "live")
      .order("homepage_position", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawCollectionRow[];
    return { status: "ok", data: rows.map(mapCollectionRow) };
  } catch {
    return { status: "error", data: null };
  }
}

async function fetchNewArrivalsStrip(
  supabase: BetkClient,
): Promise<HomepageStrip<ListingSummary[]>> {
  try {
    const { data, error } = await supabase
      .schema("betk")
      .from("listings")
      .select(LISTING_SUMMARY_SELECT)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(HOMEPAGE_STRIP_LIMIT);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawListingSummaryRow[];
    return { status: "ok", data: rows.map(mapListingSummaryRow) };
  } catch {
    return { status: "error", data: null };
  }
}

const BOOSTED_SELECT = `
  listing_id, created_at,
  listings ( ${LISTING_SUMMARY_SELECT} )
`;

interface RawBoostRow {
  listing_id: string;
  created_at: string;
  listings: RawListingSummaryRow | RawListingSummaryRow[] | null;
}

async function fetchBoostedStrip(supabase: BetkClient): Promise<HomepageStrip<ListingSummary[]>> {
  try {
    const { data, error } = await supabase
      .schema("betk")
      .from("boosts")
      .select(BOOSTED_SELECT)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(HOMEPAGE_STRIP_LIMIT);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as RawBoostRow[];
    const listings = rows
      .map((row) => asSingle(row.listings))
      .filter((l): l is RawListingSummaryRow => l !== null)
      .map(mapListingSummaryRow);

    return { status: "ok", data: listings };
  } catch {
    return { status: "error", data: null };
  }
}

/**
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function getHomepageData(client?: DiscoveryClient): Promise<HomepageData> {
  const supabase = client ?? (await createClient());

  const [collections, newArrivals, boosted] = await Promise.all([
    fetchCollectionsStrip(supabase),
    fetchNewArrivalsStrip(supabase),
    fetchBoostedStrip(supabase),
  ]);

  return { collections, newArrivals, boosted };
}
