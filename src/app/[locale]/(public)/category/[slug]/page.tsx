/**
 * Category Browse (`/category/[slug]`, `/en/category/[slug]`) — PUBLIC route.
 * Phase 03 / T04 (FR-PUB-3). Wrapped by PublicShell (AppChrome + Footer) via
 * `(public)/layout.tsx` — chrome is NOT touched here.
 *
 * RSC: resolves the category by slug (`getCategoryBySlug`, T04) — is_active
 * =false OR unknown slug both resolve to `null` → hard `notFound()` (no
 * existence leak, same convention as `getStoreBySlug`'s R-S07 handling).
 * This decision stays OUTSIDE any Suspense boundary (hard-404 binding rule,
 * BL-01-FIX/T04) — it commits before any streaming starts. Under ISR the 404
 * verdict is cached per-path (an unknown slug stays a hard 404 on repeat hits).
 *
 * ── PERF-02: ISR (revalidate 60) + off-URL pagination ─────────────────────
 * This route is now ISR-cached. Two things were required to flip it from
 * per-request dynamic to ISR:
 *   1. Locale is threaded EXPLICITLY, never read from the request store. The
 *      locale comes from the validated `[locale]` segment param and is passed
 *      to every `getTranslations({locale})` here + down into
 *      `CategoryListingsSection`/`SubcategoryChips` (and their `<Link locale>`).
 *      `setRequestLocale(locale)` is still called (it primes the client
 *      provider), but the render path does NOT depend on it: next-intl's
 *      `setRequestLocale` cache() store is only guaranteed inside pages/layouts,
 *      and during runtime on-demand ISR generation of a NON-default locale the
 *      streamed Suspense child would otherwise miss it, fall back to `headers()`
 *      and abort generation with DYNAMIC_SERVER_USAGE (default locale masked by
 *      next-intl's fallback). Explicit locale is the documented static-render
 *      escape hatch and works on both the first-hit and revalidation paths.
 *   2. Removing the page-level `searchParams` read. Reading `searchParams`
 *      unconditionally forces dynamic rendering (the exact reason `/search`
 *      stays dynamic). Forward `?cursor=` pagination therefore moved OFF the
 *      URL: the page renders page 1 only, and `CategoryLoadMore` (client)
 *      appends further pages in place via `GET /api/category-listings`. An old
 *      `?cursor=` deep link now simply renders page 1 (the param is ignored) —
 *      accepted trade-off, recorded in docs/02-architecture/CACHING_STRATEGY.md.
 *
 * All reads go through the stateless anon client (no `cookies()`), so nothing
 * in the render path re-forces dynamic (see also REG-37: `rating_aggregates`
 * inherits this 60s TTL). The PERF-01 Suspense/streaming is intact on the ISR
 * MISS path (first hit / revalidation); a cache HIT serves complete HTML.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategoryBySlug } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { SkeletonGrid } from "@/components/shared";
import { SubcategoryChips } from "@/features/discovery/components/SubcategoryChips";
import { CategoryListingsSection } from "@/features/discovery/components/CategoryListingsSection";

export const revalidate = 60;

/**
 * PERF-02: enable ISR for this dynamic segment. We prerender NO specific slugs
 * at build (the catalog is DB-owned and changes at runtime); with the default
 * `dynamicParams = true`, each `/category/<slug>` is generated on its first hit
 * and then cached per `revalidate` (60s). Without a `generateStaticParams`
 * export, a dynamic segment renders per-request (`ƒ`) even with `revalidate`
 * set — the build route table is the proof (`ƒ` → ISR only once this exists).
 */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

interface RouteParams {
  locale: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "category" });

  const category = await getCategoryBySlug(slug, createAnonClient());
  if (!category) {
    return { title: t("metaTitleFallback") };
  }

  const name = localizedName(
    { ar: category.nameAr, en: category.nameEn },
    locale as AppLocale,
  );
  return {
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const appLocale = locale as AppLocale;

  const supabase = createAnonClient();

  const category = await getCategoryBySlug(slug, supabase);
  if (!category) {
    // is_active=false OR unknown slug — both 404 (no existence leak).
    notFound();
  }

  const name = localizedName({ ar: category.nameAr, en: category.nameEn }, appLocale);
  const parent = category.parent
    ? {
        slug: category.parent.slug,
        name: localizedName(
          { ar: category.parent.nameAr, en: category.parent.nameEn },
          appLocale,
        ),
      }
    : null;

  const subcategoryItems = category.children.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: localizedName({ ar: c.nameAr, en: c.nameEn }, appLocale),
  }));

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-bold text-foreground">{name}</h1>
      </div>

      <SubcategoryChips items={subcategoryItems} locale={appLocale} />

      <Suspense fallback={<SkeletonGrid />}>
        <CategoryListingsSection
          categoryId={category.id}
          categoryName={name}
          parent={parent}
          locale={appLocale}
        />
      </Suspense>
    </div>
  );
}
