/**
 * Search & Filter (`/search`, `/en/search`) — PUBLIC route. Phase 03 / T03
 * (FR-PUB-2). Wrapped by PublicShell (AppChrome + Footer) via (public)/layout
 * — chrome is NOT touched here.
 *
 * RSC: reads the locale-neutral URL search params, runs `searchListings` (T01
 * conventions — anon client, RLS-bound, no service-role) server-side, and hands
 * the parsed params + result page to the client <SearchView>, which owns all
 * interaction and writes state back into the URL (shareable results).
 *
 * Dynamic by nature (depends on searchParams) — no ISR. Reads go through the
 * stateless anon client (RLS still applies), same as the rest of the discovery
 * read layer.
 */

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getCategoryTree, searchListings } from "@/features/discovery";
import { searchListingsParamsSchema } from "@/features/discovery";
import type { SearchResultPage } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { SearchView } from "@/features/discovery/components/SearchView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const locale = (await getLocale()) as AppLocale;

  // Parse defensively — a tampered/stale shareable URL degrades to defaults,
  // never a 500 (safeParse + fallback to the schema's own defaults).
  const rawParams = {
    q: first(sp.q),
    category: first(sp.category),
    type: first(sp.type),
    governorate: first(sp.governorate),
    city: first(sp.city),
    priceMin: first(sp.price_min),
    priceMax: first(sp.price_max),
    sort: first(sp.sort),
    page: first(sp.page),
  };
  const parsedResult = searchListingsParamsSchema.safeParse(rawParams);
  const parsed = parsedResult.success ? parsedResult.data : searchListingsParamsSchema.parse({});

  const supabase = createAnonClient();

  // Category filter pills — best-effort (a failed tree never blocks results).
  let categories: { id: string; name: string }[] = [];
  try {
    const tree = await getCategoryTree(supabase);
    categories = tree.map((c) => ({
      id: c.id,
      name: localizedName({ ar: c.nameAr, en: c.nameEn }, locale),
    }));
  } catch {
    categories = [];
  }

  let result: SearchResultPage = { items: [], page: parsed.page, pageSize: 24, total: 0, hasMore: false };
  let isError = false;
  try {
    result = await searchListings(parsed, supabase);
  } catch {
    isError = true;
  }

  // Re-seed the client draft on every navigation (params define the key).
  const stateKey = JSON.stringify(parsed);

  return (
    <SearchView
      key={stateKey}
      q={parsed.q ?? ""}
      category={parsed.category}
      type={parsed.type}
      governorate={parsed.governorate}
      city={parsed.city}
      priceMin={parsed.priceMin}
      priceMax={parsed.priceMax}
      sort={parsed.sort}
      page={parsed.page}
      items={result.items}
      total={result.total}
      hasMore={result.hasMore}
      isError={isError}
      categories={categories}
    />
  );
}
