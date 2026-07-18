"use client";

/**
 * ListingCardLink — client "island" wiring a single ListingCard's navigation.
 * Phase 03 / T02 (composition only — ListingCard/WishlistButton are untouched
 * Claude-Design components).
 *
 * - Card click → /listing/[id].
 * - Wishlist heart click → ALWAYS routes to /auth/login?returnUrl=/listing/[id]
 *   (locale-preserving via `@/i18n/navigation`). The real toggle mutation for
 *   grid cards is out of T06's scope (T06 wires the storefront FollowButton +
 *   the detail-page wishlist state); catalog-grid hearts stay entry/redirect
 *   only, so every click (guest or authed) goes to login for now.
 *
 * CD-DELTA-2 (T06): the two shared-kit gaps T02 worked around here are now
 * fixed at the source and consumed directly:
 *   1. `WishlistButton` calls `stopPropagation()`/`preventDefault()` internally,
 *      so a heart click no longer bubbles to the card's `onClick` — the
 *      same-tick `skipNavigate` ref flag is DELETED (dead code).
 *   2. `ListingCard` now forwards `wishlistAddLabel`/`wishlistRemoveLabel` to
 *      the heart, so the aria-label localizes under `/en`; threaded through
 *      from the catalog message catalog by every composition site.
 */

import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { ListingCard } from "@/components/shared";
import type { PriceType } from "@/constants/enums";

export interface ListingCardLinkProps {
  id: string;
  title: string;
  image?: string | null;
  price?: number | null;
  priceType: PriceType;
  storeName?: string | null;
  rating?: number | null;
  reviews?: number | null;
  boosted?: boolean;
  boostLabel: string;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
  stockQty?: number | null;
  isMadeToOrder?: boolean;
  isService?: boolean;
  className?: string;
}

export function ListingCardLink({
  id,
  title,
  image,
  price,
  priceType,
  storeName,
  rating,
  reviews,
  boosted,
  boostLabel,
  wishlistAddLabel,
  wishlistRemoveLabel,
  stockQty,
  isMadeToOrder,
  isService,
  className,
}: ListingCardLinkProps) {
  const router = useRouter();

  return (
    <ListingCard
      titleAr={title}
      image={image ?? undefined}
      price={price}
      priceType={priceType}
      storeName={storeName ?? undefined}
      rating={typeof rating === "number" ? rating : undefined}
      reviews={reviews ?? undefined}
      boosted={boosted}
      boostLabel={boostLabel}
      saved={false}
      wishlistAddLabel={wishlistAddLabel}
      wishlistRemoveLabel={wishlistRemoveLabel}
      stockQty={stockQty}
      isMadeToOrder={isMadeToOrder}
      isService={isService}
      className={className}
      onClick={() => {
        router.push(routes.listing(id));
      }}
      onToggleSave={() => {
        router.push(`${routes.auth.login}?returnUrl=${encodeURIComponent(routes.listing(id))}`);
      }}
    />
  );
}
