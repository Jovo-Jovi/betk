/**
 * searchListings — full-text catalog search + filters. Phase 03 / T03 (FR-PUB-2).
 *
 * Runs under the cookie/anon server client (RSC) or an injected plain anon
 * client (integration tests) — public RLS is the boundary, NEVER service-role,
 * NO new policies. Mirrors the T01 query conventions (typed returns,
 * Zod-validated params, `.schema("betk")`, injectable `DiscoveryClient`).
 *
 * ── Always-enforced visibility ────────────────────────────────────────────
 *  - `status = 'active' AND deleted_at IS NULL` on every branch (R-L10).
 *  - `stores!inner(...)`: the store embed is an INNER join, so a listing only
 *    surfaces when its store is anon-readable — and `stores_public` RLS exposes
 *    only `status='active'` stores. This is what excludes SUSPENDED-store
 *    listings (R-S07): `listings_public` alone does NOT check store status, so
 *    an active listing under a suspended store would otherwise leak. The inner
 *    join also backs the governorate/city filters (both live on `stores`).
 *
 * ── Full-text (search_vector) ──────────────────────────────────────────────
 *  The `update_listing_search_vector` trigger builds the vector with the
 *  `'arabic'` config (title_ar, weight A) + `'english'` config (title_en B,
 *  description_ar C) — NOT `unaccent` (OD-7 §7 carry, re-verified live). The
 *  `'arabic'` config normalises Arabic diacritics, so a diacritic/non-diacritic
 *  query matches both ways without unaccent; the `'english'` snowball stemmer
 *  matches the English-stemmed lexemes. A single `websearch_to_tsquery` call
 *  takes ONE config, so the query config is routed by script (`pickTsConfig`).
 *
 * ── R-B04 boosted ranking ──────────────────────────────────────────────────
 *  Docs pin the RULE — "boosted ranking via boosts.status='active'"
 *  (BETK_PRD FR-PUB-2 / BETK_UI_SPEC §Search "boosted-results banner at top of
 *  relevant category") — but no numeric weight/formula. So NO weight is
 *  invented: results are a two-tier partition — listings with an ACTIVE boost
 *  that ALSO match the query+filters come first (the "relevant result set"
 *  scope), then organic matches. Within each tier the user-selected sort is the
 *  tiebreak (the documented sort options). Matches the phase pack's own
 *  framing: "active-boost listings above organic within the relevant result set".
 *
 * ── Pagination ─────────────────────────────────────────────────────────────
 *  Offset pagination for ALL sort modes (not T01's keyset). Rationale (stated
 *  in the close-out): the two-tier boosted/organic ordering isn't a single
 *  keyset column, and 'relevance' has no keyset-able rank. Offset keeps every
 *  sort consistent and correct at the public-browse scale (ARCHITECTURE:
 *  tsvector+GIN safe to ~500K).
 */

import { createClient } from "@/lib/supabase/server";
import {
  searchListingsParamsSchema,
  pickTsConfig,
  type SearchListingsParams,
  type SearchSort,
} from "@/validations/discovery";
import type { SearchListingItem, SearchResultPage } from "../types";
import {
  LISTINGS_PAGE_SIZE,
  LISTING_SUMMARY_SELECT,
  mapListingSummaryRow,
  type DiscoveryClient,
  type RawListingSummaryRow,
} from "./_shared";

/**
 * Card select with the store embed forced to an INNER join (see file header) —
 * derived from the shared card select so the field list can't drift.
 */
const SEARCH_LISTING_SELECT = LISTING_SUMMARY_SELECT.replace("stores (", "stores!inner (");

/**
 * Cap on how many active-boosted matches we materialise for the top tier.
 * Boosts are paid + guarded to one active per listing (R-B01); the matching
 * subset is small. If ever exceeded, `total` slightly under-counts — acceptable
 * for a public browse surface, noted rather than paid for with another query.
 */
const BOOSTED_TIER_CAP = 100;

const SEARCH_PAGE_SIZE = LISTINGS_PAGE_SIZE;

/**
 * Minimal F-bounded shape of the PostgREST filter builder we chain — every
 * method returns the same builder type, so the real
 * `PostgrestFilterBuilder` satisfies `Chainable<itself>` and its concrete type
 * (incl. `.range()` / awaitable result) is preserved at the call site. Avoids
 * naming supabase-js's deeply-parameterised builder generics or reaching for
 * `any`.
 */
interface Chainable<T> {
  eq(column: string, value: string): T;
  is(column: string, value: null): T;
  gte(column: string, value: number): T;
  lte(column: string, value: number): T;
  in(column: string, values: readonly string[]): T;
  not(column: string, operator: string, value: string): T;
  textSearch(
    column: string,
    query: string,
    options?: { type?: "plain" | "phrase" | "websearch"; config?: string },
  ): T;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): T;
}

interface ResolvedFilters {
  q?: string;
  category?: string;
  type?: "product" | "service";
  governorate?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
}

/** WHERE/text-search predicates shared by both tiers and the count query. */
function applyFilters<T extends Chainable<T>>(query: T, f: ResolvedFilters): T {
  let q = query.eq("status", "active").is("deleted_at", null);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.type) q = q.eq("type", f.type);
  if (f.governorate) q = q.eq("stores.governorate", f.governorate);
  if (f.city) q = q.eq("stores.city", f.city);
  if (typeof f.priceMin === "number") q = q.gte("price", f.priceMin);
  if (typeof f.priceMax === "number") q = q.lte("price", f.priceMax);
  if (f.q) q = q.textSearch("search_vector", f.q, { type: "websearch", config: pickTsConfig(f.q) });
  return q;
}

/**
 * Deterministic ordering within a tier. Every mode carries an `id` tiebreak so
 * offset pages don't drift on ties. 'relevance' falls back to recency: true
 * `ts_rank` ordering can't be expressed through the PostgREST query builder
 * without a DB rank function/generated column — a DB-classed change out of this
 * query-only task's scope — so matches are ordered newest-first (stated in the
 * close-out, not silently claimed as rank-scored).
 */
function applySort<T extends Chainable<T>>(query: T, sort: SearchSort): T {
  switch (sort) {
    case "price":
      return query
        .order("price", { ascending: true, nullsFirst: false })
        .order("id", { ascending: false });
    case "popularity":
      return query.order("view_count", { ascending: false }).order("id", { ascending: false });
    case "newest":
    case "relevance":
    default:
      return query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }
}

/**
 * @param params  URL-sourced search params (Zod-validated + coerced here).
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function searchListings(
  params: SearchListingsParams = {},
  client?: DiscoveryClient,
): Promise<SearchResultPage> {
  const parsed = searchListingsParamsSchema.parse(params);
  const supabase = client ?? (await createClient());

  const filters: ResolvedFilters = {
    q: parsed.q,
    category: parsed.category,
    type: parsed.type,
    governorate: parsed.governorate,
    city: parsed.city,
    priceMin: parsed.priceMin,
    priceMax: parsed.priceMax,
  };

  const pageSize = SEARCH_PAGE_SIZE;
  const start = (parsed.page - 1) * pageSize;
  const end = start + pageSize;

  const betk = () => supabase.schema("betk");

  // ── Active-boost listing ids (R-B04 top tier). `boosts_public` exposes
  //    status='active' to anon. Degrade to "no boost tier" on read error —
  //    boosted ranking is an enhancement, never a hard dependency of search.
  let boostedIds: string[] = [];
  try {
    const { data: boostRows } = await betk()
      .from("boosts")
      .select("listing_id")
      .eq("status", "active")
      .limit(BOOSTED_TIER_CAP);
    boostedIds = Array.from(
      new Set(((boostRows ?? []) as { listing_id: string }[]).map((r) => r.listing_id)),
    );
  } catch {
    boostedIds = [];
  }

  // ── Boosted tier: matching listings that also carry an active boost.
  let boostedItems: SearchListingItem[] = [];
  if (boostedIds.length > 0) {
    const built = applySort(
      applyFilters(betk().from("listings").select(SEARCH_LISTING_SELECT).in("id", boostedIds), filters),
      parsed.sort,
    );
    const { data, error } = await built.limit(BOOSTED_TIER_CAP);
    if (error) throw new Error(`[discovery] searchListings (boosted) failed: ${error.message}`);
    boostedItems = ((data ?? []) as unknown as RawListingSummaryRow[]).map((row) => ({
      ...mapListingSummaryRow(row),
      isBoosted: true,
    }));
  }
  const boostedCount = boostedItems.length;

  // ── Organic count: full matching set WITHOUT an active boost.
  let organicCountQuery = applyFilters(
    betk().from("listings").select("id", { count: "exact", head: true }),
    filters,
  );
  if (boostedIds.length > 0) {
    organicCountQuery = organicCountQuery.not("id", "in", `(${boostedIds.join(",")})`);
  }
  const { count: organicCountRaw, error: countErr } = await organicCountQuery;
  if (countErr) throw new Error(`[discovery] searchListings (count) failed: ${countErr.message}`);
  const organicCount = organicCountRaw ?? 0;

  // ── Compose the requested page window across [boosted…, organic…].
  const boostedPage = boostedItems.slice(Math.min(start, boostedCount), Math.min(end, boostedCount));
  const organicFrom = Math.max(0, start - boostedCount);
  const organicTo = Math.max(0, end - boostedCount);
  const organicNeeded = organicTo - organicFrom;

  let organicPage: SearchListingItem[] = [];
  if (organicNeeded > 0 && organicFrom < organicCount) {
    let organicQuery = applySort(
      applyFilters(betk().from("listings").select(SEARCH_LISTING_SELECT), filters),
      parsed.sort,
    );
    if (boostedIds.length > 0) {
      organicQuery = organicQuery.not("id", "in", `(${boostedIds.join(",")})`);
    }
    const { data, error } = await organicQuery.range(organicFrom, organicFrom + organicNeeded - 1);
    if (error) throw new Error(`[discovery] searchListings (organic) failed: ${error.message}`);
    organicPage = ((data ?? []) as unknown as RawListingSummaryRow[]).map((row) => ({
      ...mapListingSummaryRow(row),
      isBoosted: false,
    }));
  }

  const items = [...boostedPage, ...organicPage];
  const total = boostedCount + organicCount;
  const hasMore = start + items.length < total;

  return { items, page: parsed.page, pageSize, total, hasMore };
}
