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
 * REG-39 (PERF-01, 2026-07-21): all 8 seeded `icon_url` values under
 * `/icons/categories/*.svg` 404 in production (evidence: Vercel prod logs,
 * 2026-07-20) — the assets were referenced in seed data but never produced/
 * deployed. `resolveIconUrl` drops any URL under that known-missing prefix
 * AT THIS FEATURE-LAYER MAPPING (the `<img>` is composed here, not inside the
 * frozen shared `CategoryGrid`, so this is the correct place to fix it — no
 * `components/shared` edit) so `icon` resolves to `undefined` and the shared
 * `CategoryGrid` renders its own Lucide `<Tag>` default instead of a broken
 * image. Real assets are owned by CD-DELTA-4 (Claude Design) — remove this
 * guard once they land at real, resolvable paths.
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

/** REG-39: known-missing seed path — see file header. */
const KNOWN_MISSING_ICON_PREFIX = "/icons/categories/";

function resolveIconUrl(iconUrl: string | null | undefined): string | null {
  if (!iconUrl || iconUrl.startsWith(KNOWN_MISSING_ICON_PREFIX)) return null;
  return iconUrl;
}

export function HomeCategoryGrid({ categories }: HomeCategoryGridProps) {
  const router = useRouter();

  return (
    <CategoryGrid
      categories={categories.map((c) => {
        const iconUrl = resolveIconUrl(c.iconUrl);
        return {
          id: c.id,
          nameAr: c.name,
          icon: iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- decorative small icon, domain not yet configured for next/image
            <img src={iconUrl} alt="" className="size-6 object-contain" />
          ) : undefined,
          onClick: () => router.push(routes.category(c.slug)),
        };
      })}
    />
  );
}
