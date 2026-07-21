"use client";

/**
 * HomeCategoryGrid — client "island" wiring CategoryGrid's tile navigation to
 * /category/[slug]. Phase 03 / T02 (composition only).
 *
 * Category names arrive already locale-resolved (COALESCE via
 * `localizedName`, done server-side in CategoriesSection) — this wrapper only
 * needs plain serializable data + the click→navigate wiring, per the
 * Server→Client boundary (functions can't cross it; a Client Component must
 * build its own handlers).
 *
 * REG-39 CLOSED (CD-DELTA-4, 2026-07-21): the 8 category icon SVGs now ship at
 * their real public paths (`/icons/categories/*.svg`), so the seeded `icon_url`
 * values render directly again — the PERF-01 stopgap that dropped that prefix
 * has been removed.
 */

import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { CategoryGrid } from "@/components/shared";

export interface HomeCategoryItem {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
}

export interface HomeCategoryGridProps {
  categories: HomeCategoryItem[];
}

export function HomeCategoryGrid({ categories }: HomeCategoryGridProps) {
  const router = useRouter();

  return (
    <CategoryGrid
      categories={categories.map((c) => ({
        id: c.id,
        nameAr: c.name,
        icon: c.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- decorative small icon, domain not yet configured for next/image
          <img src={c.iconUrl} alt="" className="size-6 object-contain" />
        ) : undefined,
        onClick: () => router.push(routes.category(c.slug)),
      }))}
    />
  );
}
