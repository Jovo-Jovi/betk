/**
 * Homepage (`/` in ar, `/en` in en) — a PUBLIC route, so it lives inside the
 * (public) group and is wrapped by PublicShell (which already provides <main>
 * + AppChrome + Footer — see (public)/layout.tsx). Phase 03 / T02.
 *
 * OD-7 note: the homepage MUST stay inside (public) rather than at the
 * [locale] root. Its Suspense/loading boundary is (public)/loading.tsx, which
 * does NOT wrap the sibling [locale]/[...rest] catch-all — so unknown paths
 * still commit a genuine 404 instead of a streamed soft-200. layout.tsx is
 * UNTOUCHED by this task (no diff).
 *
 * Data: Hero is static markup + SearchBar (no fetch). Categories and the
 * three homepage strips (collections/new-arrivals/boosted) are each fetched
 * independently — see CategoriesSection / HomeStripsSection — via the
 * stateless anon client (no `cookies()`), which is what lets `revalidate`
 * below actually cache the underlying Postgres reads instead of hitting the
 * DB on every request.
 *
 * Caching (ARCHITECTURE §caching): "homepage endpoint 60s, rating_aggregates
 * 5-min". Implemented as Next.js ISR — `export const revalidate = 60` below
 * — the standard, zero-new-dependency mechanism for a public, non-
 * personalized RSC page. `rating_aggregates` arrives EMBEDDED inside the same
 * listing/store select (T01's `LISTING_SUMMARY_SELECT`), so it inherits this
 * same 60s TTL rather than an independently-tracked 5-minute one; decomposing
 * that embed into its own query to get a distinct TTL would mean reshaping
 * T01's query layer, out of scope for a composition-only task — flagged in
 * the close-out, not silently invented.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { HeroSection } from "@/features/discovery/components/HeroSection";
import { CategoriesSection } from "@/features/discovery/components/CategoriesSection";
import { HomeStripsSection } from "@/features/discovery/components/HomeStripsSection";
import { catalogSearchBarLabels } from "@/i18n/catalogLabels";
import { CategoryGridSkeleton, SkeletonGrid } from "@/components/shared";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

function HomeStripsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <SkeletonGrid count={4} />
      <SkeletonGrid count={8} />
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const catalogT = await getTranslations("catalog");
  const searchLabels = catalogSearchBarLabels(catalogT);

  return (
    <div className="flex flex-col gap-10 pb-10">
      <HeroSection
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        searchPlaceholder={t("hero.searchPlaceholder")}
        searchClearLabel={searchLabels.clearLabel}
      />

      <div className="mx-auto flex w-full max-w-container flex-col gap-10 px-4">
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoriesSection />
        </Suspense>

        <Suspense fallback={<HomeStripsSkeleton />}>
          <HomeStripsSection />
        </Suspense>
      </div>
    </div>
  );
}
