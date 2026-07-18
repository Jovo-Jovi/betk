"use client";

/**
 * ListingCardLink — client "island" wiring a single ListingCard's navigation.
 * Phase 03 / T02 (composition only — ListingCard/WishlistButton are untouched
 * Claude-Design components).
 *
 * - Card click → /listing/[id].
 * - Wishlist heart click → ALWAYS routes to /auth/login?returnUrl=/listing/[id]
 *   (locale-preserving via `@/i18n/navigation`). The real toggle mutation is
 *   T06 (`toggleWishlist` Server Action) — T02 is entry/redirect only, so
 *   every click (guest or authed) goes to login for now, per the T02 scope.
 *
 * Two shared-kit gaps found while wiring this, NOT fixed here (compose-only —
 * flagged to Claude Design instead of editing components/shared):
 *   1. `ListingCardProps` has no pass-through for WishlistButton's
 *      `addLabel`/`removeLabel` (only `boostLabel` is exposed), so the
 *      wishlist heart's aria-label stays Arabic-only even under `/en` — a
 *      bilingual gap in ListingCard itself, out of T02's reach.
 *   2. WishlistButton's internal onClick doesn't call `e.stopPropagation()`,
 *      so a heart click also bubbles to ListingCard's own `onClick` (both are
 *      plain DOM handlers on nested elements). Worked around below with a
 *      same-tick ref flag (`skipNavigate`) rather than editing the shared
 *      components — recommend Claude Design add `stopPropagation()` there.
 */

import { useRef } from "react";
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
  stockQty,
  isMadeToOrder,
  isService,
  className,
}: ListingCardLinkProps) {
  const router = useRouter();
  const skipNavigate = useRef(false);

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
      stockQty={stockQty}
      isMadeToOrder={isMadeToOrder}
      isService={isService}
      className={className}
      onClick={() => {
        if (skipNavigate.current) {
          skipNavigate.current = false;
          return;
        }
        router.push(routes.listing(id));
      }}
      onToggleSave={() => {
        skipNavigate.current = true;
        router.push(`${routes.auth.login}?returnUrl=${encodeURIComponent(routes.listing(id))}`);
      }}
    />
  );
}
