/**
 * getFeaturedStores — homepage StoreCard row (D2, REG-111).
 *
 * One PostgREST request on the stateless anon client (same client
 * HomeStripsSection passes to getHomepageData), so the home page stays ISR.
 *
 * Rule: stores.status = 'active' (stores_public) with at least one listing
 * whose status is 'active' and deleted_at is null. Browse grids stay
 * active-only in the query; live listings_public also admits sold_out for
 * the detail page (REG-25) and that status does not qualify a store here.
 * Order: rating_aggregates.average_rating descending, nulls last (no
 * aggregate row = unrated, after every rated store), then stores.created_at
 * descending (ties: newest first). Parent limit 8 is the request's `limit`
 * param. The listings embed is `!inner` with limit 1 — it only proves a
 * qualifying listing exists. No listing count is read or returned.
 */

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { FeaturedStore } from "../types";
import type { DiscoveryClient } from "./_shared";
import { mapFeaturedStore, type RawFeaturedStoreRow } from "./mapFeaturedStore";

/** Bound in the database request. Never trim the array in app code. */
export const FEATURED_STORES_LIMIT = 8;

const FEATURED_STORES_SELECT = `
  id, slug, name_ar, name_en, avatar_url, cover_url, governorate, created_at,
  rating_aggregates ( average_rating, total_reviews ),
  seller_profiles ( level, is_verified ),
  listings!inner ( id )
`;

/**
 * @param locale  request locale, used only to map display strings and hrefs.
 * @param client  anon client override (integration tests). RSC callers omit
 *                this and get the cookie client — the home page passes
 *                createAnonClient() instead, so this read stays cacheable.
 */
export async function getFeaturedStores(
  locale: AppLocale,
  client?: DiscoveryClient,
): Promise<FeaturedStore[]> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select(FEATURED_STORES_SELECT)
    .eq("status", "active")
    .eq("listings.status", "active")
    .is("listings.deleted_at", null)
    .order("rating_aggregates(average_rating)", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(FEATURED_STORES_LIMIT)
    .limit(1, { referencedTable: "listings" });

  if (error) {
    throw new Error(`[discovery] getFeaturedStores failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawFeaturedStoreRow[];
  return rows.map((row) => mapFeaturedStore(row, locale));
}
