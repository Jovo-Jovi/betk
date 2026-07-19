"use client";

/**
 * CategoryLoadMore — forward-only cursor pagination for the category grid.
 * Phase 03 / T04 (composition only).
 *
 * T01's `getActiveListings` is keyset (opaque `nextCursor`), not offset —
 * unlike `/search` (T03's stated offset fallback), there's a real cursor
 * here, so pagination is expressed as "load the next page" by navigating to
 * the SAME route with `?cursor=<nextCursor>` appended (locale-preserving via
 * `@/i18n/navigation`'s `useRouter`, the same imperative-push mechanism
 * `SearchView`/`HomeCategoryGrid` already use for typed-route-safe dynamic
 * hrefs). No "previous" — a keyset cursor has no natural back-navigation
 * without maintaining a client-side cursor stack, out of this task's scope;
 * the browser back button still works (each "load more" is a real navigation
 * with its own URL, not a client-state mutation).
 */

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export interface CategoryLoadMoreProps {
  href: string;
  label: string;
}

export function CategoryLoadMore({ href, label }: CategoryLoadMoreProps) {
  const router = useRouter();

  return (
    <div className="mt-2 flex justify-center">
      <Button variant="outline" onClick={() => router.push(href)}>
        {label}
      </Button>
    </div>
  );
}
