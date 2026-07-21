"use client";

/**
 * CategoryLoadMore — the category listings grid + in-place "load more" append.
 * Phase 03 / T04, rewired by PERF-02.
 *
 * PERF-02: `/category/[slug]` is now ISR-cached (revalidate 60) and no longer
 * reads `?cursor=` at the page level (a `searchParams` read would force the
 * route dynamic — the exact reason `/search` stays dynamic). So forward
 * pagination moved off the URL: the server section (`CategoryListingsSection`)
 * fetches page 1 and hands it here; this client island renders the grid and,
 * on demand, appends further pages IN PLACE by calling the public, anon,
 * read-only `GET /api/category-listings` handler (Zod-gated, same R-S07-safe
 * query + page size as the page's own grid). The cursor lives in component
 * state, not the URL.
 *
 * TRADE-OFF (accepted, recorded in CACHING_STRATEGY.md): deep pagination is no
 * longer URL-addressable and a shared `/category/slug` link always opens on
 * page 1. This is the cost of making the page ISR-cacheable; the previous
 * `?cursor=` deep links (which forced the whole route dynamic) are gone — an
 * old `?cursor=` URL now simply renders page 1 (the param is ignored).
 *
 * T01's `getActiveListings` is keyset (opaque `nextCursor`), not offset — there
 * is a real cursor, so "load more" is forward-only (no "previous"); the append
 * grows the in-memory list.
 */

import { useState } from "react";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import type { ListingPage, ListingSummary } from "@/features/discovery";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListingCardLink } from "./ListingCardLink";

export interface CategoryLoadMoreProps {
  categoryId: string;
  locale: AppLocale;
  initialItems: ListingSummary[];
  initialCursor: string | null;
  boostLabel: string;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
  loadMoreLabel: string;
  retryLabel: string;
  errorLabel: string;
}

export function CategoryLoadMore({
  categoryId,
  locale,
  initialItems,
  initialCursor,
  boostLabel,
  wishlistAddLabel,
  wishlistRemoveLabel,
  loadMoreLabel,
  retryLabel,
  errorLabel,
}: CategoryLoadMoreProps) {
  const [items, setItems] = useState<ListingSummary[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function loadMore() {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    setHasError(false);
    try {
      const params = new URLSearchParams({ category: categoryId, cursor, locale });
      const res = await fetch(`/api/category-listings?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as ListingPage;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {items.map((listing) => (
          <ListingCardLink
            key={listing.id}
            id={listing.id}
            title={localizedName({ ar: listing.titleAr, en: listing.titleEn }, locale)}
            image={listing.heroImageUrl}
            price={listing.price}
            priceType={listing.priceType}
            storeName={
              listing.store
                ? localizedName({ ar: listing.store.nameAr, en: listing.store.nameEn }, locale)
                : null
            }
            rating={listing.store?.rating?.averageRating ?? null}
            reviews={listing.store?.rating?.totalReviews ?? null}
            boostLabel={boostLabel}
            wishlistAddLabel={wishlistAddLabel}
            wishlistRemoveLabel={wishlistRemoveLabel}
            stockQty={listing.stockQty}
            isMadeToOrder={listing.isMadeToOrder}
            isService={listing.type === "service"}
          />
        ))}
      </div>

      {cursor && (
        <div className="mt-2 flex flex-col items-center gap-2">
          {hasError && <p className="text-sm text-destructive">{errorLabel}</p>}
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
            aria-busy={isLoading}
            className={cn(isLoading && "cursor-progress opacity-60")}
          >
            {hasError ? retryLabel : loadMoreLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
