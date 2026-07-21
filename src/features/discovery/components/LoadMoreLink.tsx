"use client";

/**
 * LoadMoreLink — forward-only, URL-based "load more" navigation button.
 * Phase 03 / T06 (composition only).
 *
 * Navigates to the SAME route with an appended `?cursor=` (locale-preserving
 * via `@/i18n/navigation`'s `useRouter`). Used by the storefront Listings tab
 * (`StoreListingsSection`), which lives on the `/store/[slug]` route that is
 * DYNAMIC by nature (per-user follow-state read via the cookie client) — so a
 * `searchParams`-driven cursor is free there and keeps deep pages URL-
 * addressable.
 *
 * NOTE: `/category/[slug]` does NOT use this — that route is ISR (PERF-02), so
 * it cannot read `searchParams`; its "load more" is the in-place client append
 * in `CategoryLoadMore` (backed by `GET /api/category-listings`). This button
 * is the URL-navigation variant reserved for dynamic routes.
 */

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export interface LoadMoreLinkProps {
  href: string;
  label: string;
}

export function LoadMoreLink({ href, label }: LoadMoreLinkProps) {
  const router = useRouter();

  return (
    <div className="mt-2 flex justify-center">
      <Button variant="outline" onClick={() => router.push(href)}>
        {label}
      </Button>
    </div>
  );
}
