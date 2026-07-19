/**
 * MoreFromStoreRail — Listing Detail's "more from this store" section.
 * Phase 03 / T05 (FR-PUB-4). Async Server Component, deliberately NOT the
 * component that decides `notFound()` (that happens synchronously in
 * `page.tsx` before this ever mounts) — safe to wrap in `<Suspense>` per the
 * T05 binding rule (in-page Suspense only, never a route `loading.tsx`).
 *
 * A failed fetch here degrades to "hidden" (returns null), same as an empty
 * result ("hide if none", per the T05 prompt) — this rail is a non-critical
 * enhancement, not core listing content, so it never blocks or errors the
 * page (Phase 03's section-level-degradation invariant, T02).
 */

import { getMoreFromStore } from "@/features/discovery";
import type { ListingSummary } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { ListingCardLink } from "./ListingCardLink";

export interface MoreFromStoreRailProps {
  storeId: string;
  excludeListingId: string;
  locale: AppLocale;
  title: string;
  boostLabel: string;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
}

export async function MoreFromStoreRail({
  storeId,
  excludeListingId,
  locale,
  title,
  boostLabel,
  wishlistAddLabel,
  wishlistRemoveLabel,
}: MoreFromStoreRailProps) {
  let items: ListingSummary[] = [];
  try {
    items = await getMoreFromStore(storeId, excludeListingId, createAnonClient());
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h2 text-foreground">{title}</h2>
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
    </section>
  );
}
