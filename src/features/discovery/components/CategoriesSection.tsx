/**
 * CategoriesSection — homepage category tiles. Phase 03 / T02.
 *
 * Server Component: fetches `getCategoryTree()` (T01) via the stateless anon
 * client (no `cookies()`) so the route stays statically revalidate-able
 * (`export const revalidate` on the page — 60s TTL per ARCHITECTURE). Top-
 * level categories only — subcategory drill-down lives at `/category/[slug]`
 * (T04), not the homepage tiles.
 *
 * Independent-strip degradation: this section catches its own fetch error
 * and renders its own `StripErrorCard` — a failed category fetch never
 * blocks the collections/new-arrivals/boosted strips below it.
 */

import { getTranslations, getLocale } from "next-intl/server";
import { getCategoryTree } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { HomeCategoryGrid } from "./HomeCategoryGrid";
import { StripErrorCard } from "./StripErrorCard";

export async function CategoriesSection() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const locale = (await getLocale()) as AppLocale;

  let categories: Awaited<ReturnType<typeof getCategoryTree>> = [];
  let failed = false;
  try {
    categories = await getCategoryTree(createAnonClient());
  } catch {
    failed = true;
  }

  if (failed) {
    return <StripErrorCard message={t("error.message")} retryLabel={tCommon("retry")} compact />;
  }

  if (categories.length === 0) {
    // No active categories seeded — nothing useful to show; not an error.
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h2 text-foreground">{t("categories.title")}</h2>
      <HomeCategoryGrid
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: localizedName({ ar: c.nameAr, en: c.nameEn }, locale),
          iconUrl: c.iconUrl,
        }))}
      />
    </section>
  );
}
