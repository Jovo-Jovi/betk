/**
 * Category Browse (`/category/[slug]`, `/en/category/[slug]`) — PUBLIC route.
 * Phase 03 / T04 (FR-PUB-3). Wrapped by PublicShell (AppChrome + Footer) via
 * `(public)/layout.tsx` — chrome is NOT touched here.
 *
 * RSC: resolves the category by slug (`getCategoryBySlug`, T04) — is_active
 * =false OR unknown slug both resolve to `null` → hard `notFound()` (no
 * existence leak, same convention as `getStoreBySlug`'s R-S07 handling).
 * This decision stays OUTSIDE any Suspense boundary (hard-404 binding rule,
 * BL-01-FIX/T04) — it commits before any streaming starts.
 *
 * PERF-01: the listings-grid fetch (`getActiveListings`, T01 + T04's category
 * OR-match + R-S07 `stores!inner` fix) is streamed via a separate
 * `CategoryListingsSection` wrapped in `<Suspense>` (`SkeletonGrid` fallback,
 * homepage CategoriesSection/HomeStripsSection precedent) — the header +
 * `SubcategoryChips` paint immediately after the cheap category read instead
 * of waiting on the listings query too, fixing the "tap feels stuck" UX
 * finding (DIAG-PERF-01 A2/REG-38). Forward pagination stays a `?cursor=`
 * URL param (see `CategoryLoadMore`, inside the streamed section).
 *
 * Reads go through the stateless anon client (no `cookies()`), same as the
 * rest of the discovery read layer — no ISR here (the page depends on
 * `searchParams.cursor`, so it's dynamic by nature, same rationale as
 * `/search`).
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getCategoryBySlug } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { SkeletonGrid } from "@/components/shared";
import { SubcategoryChips } from "@/features/discovery/components/SubcategoryChips";
import { CategoryListingsSection } from "@/features/discovery/components/CategoryListingsSection";

interface RouteParams {
  slug: string;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("category");

  const category = await getCategoryBySlug(slug, createAnonClient());
  if (!category) {
    return { title: t("metaTitleFallback") };
  }

  const name = localizedName({ ar: category.nameAr, en: category.nameEn }, locale);
  return {
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = (await getLocale()) as AppLocale;

  const supabase = createAnonClient();

  const category = await getCategoryBySlug(slug, supabase);
  if (!category) {
    // is_active=false OR unknown slug — both 404 (no existence leak).
    notFound();
  }

  const name = localizedName({ ar: category.nameAr, en: category.nameEn }, locale);
  const cursor = first(sp.cursor);
  const parent = category.parent
    ? {
        slug: category.parent.slug,
        name: localizedName({ ar: category.parent.nameAr, en: category.parent.nameEn }, locale),
      }
    : null;

  const subcategoryItems = category.children.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: localizedName({ ar: c.nameAr, en: c.nameEn }, locale),
  }));

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-bold text-foreground">{name}</h1>
      </div>

      <SubcategoryChips items={subcategoryItems} />

      <Suspense fallback={<SkeletonGrid />}>
        <CategoryListingsSection
          categoryId={category.id}
          categorySlug={slug}
          categoryName={name}
          parent={parent}
          cursor={cursor}
        />
      </Suspense>
    </div>
  );
}
