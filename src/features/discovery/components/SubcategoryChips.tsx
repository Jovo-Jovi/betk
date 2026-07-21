/**
 * SubcategoryChips — category page's children row, each linking to its own
 * `/category/[slug]` page. Phase 03 / T04 (composition only).
 *
 * Plain server-rendered links (via `@/i18n/navigation`'s `Link`, locale-
 * preserving) wrapping the shadcn `Badge` base primitive — no new
 * `components/shared` entry needed, this is page-level composition, not a
 * reusable catalog component from the T00 design handoff. Token-based
 * (`Badge`'s own `outline` variant), no hardcoded colors.
 *
 * PERF-02: renders in the ISR `/category/[slug]` shell, so the `locale` is
 * passed EXPLICITLY to each `<Link locale>` rather than read from next-intl's
 * request store — the server `<Link>` would otherwise call `getLocale()`, which
 * on the runtime on-demand ISR path for a non-default locale falls back to
 * `headers()` and aborts static generation (see the page header comment).
 */

import { Link } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";

export interface SubcategoryChipItem {
  id: string;
  slug: string;
  name: string;
}

export interface SubcategoryChipsProps {
  items: SubcategoryChipItem[];
  locale: AppLocale;
}

export function SubcategoryChips({ items, locale }: SubcategoryChipsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link key={item.id} href={routes.category(item.slug)} locale={locale}>
          <Badge variant="outline" className="px-3 py-1 text-[0.8125rem] font-semibold hover:bg-muted">
            {item.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
