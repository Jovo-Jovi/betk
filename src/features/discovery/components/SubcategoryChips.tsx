/**
 * SubcategoryChips — category page's children row, each linking to its own
 * `/category/[slug]` page. Phase 03 / T04 (composition only).
 *
 * Plain server-rendered links (via `@/i18n/navigation`'s `Link`, locale-
 * preserving) wrapping the shadcn `Badge` base primitive — no new
 * `components/shared` entry needed, this is page-level composition, not a
 * reusable catalog component from the T00 design handoff. Token-based
 * (`Badge`'s own `outline` variant), no hardcoded colors.
 */

import { Link } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";

export interface SubcategoryChipItem {
  id: string;
  slug: string;
  name: string;
}

export interface SubcategoryChipsProps {
  items: SubcategoryChipItem[];
}

export function SubcategoryChips({ items }: SubcategoryChipsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link key={item.id} href={routes.category(item.slug)}>
          <Badge variant="outline" className="px-3 py-1 text-[0.8125rem] font-semibold hover:bg-muted">
            {item.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
