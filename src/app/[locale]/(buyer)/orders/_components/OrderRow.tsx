/**
 * OrderRow — one `/orders` list row (Phase 07 / T04, UI_SPEC "Order History"
 * L260: "order cards (BETK ref, store, thumbnail, total, `StatusBadge`,
 * date)"). Structural composition (`PriceBlock` + `StatusBadge`, a plain
 * `<img>` thumbnail) — NOT a new styled DS component; mirrors the
 * `ListingsList` row precedent (Phase 05 / T03: "a responsive CSS-grid row…
 * structural composition, not a new styled DS component"). Server Component —
 * no client state, the whole card is a single `Link` to `/orders/[id]`.
 */

import { Link } from "@/i18n/navigation";
import { PriceBlock, StatusBadge } from "@/components/shared";
import { ImageOff } from "lucide-react";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";
import type { OrderSummary } from "@/features/orders";

export interface OrderRowProps {
  order: OrderSummary;
  locale: AppLocale;
  currency: string;
  statusLabel: string;
  dateLocale: string;
}

export function OrderRow({ order, locale, currency, statusLabel, dateLocale }: OrderRowProps) {
  const listingTitle = order.listing
    ? localizedName({ ar: order.listing.titleAr, en: order.listing.titleEn }, locale)
    : null;
  const storeName = order.store
    ? localizedName({ ar: order.store.nameAr, en: order.store.nameEn }, locale)
    : null;
  const date = new Intl.DateTimeFormat(dateLocale, { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(order.createdAt),
  );

  return (
    <Link
      href={routes.buyer.orderDetail(order.id)}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {order.listing?.heroImageUrl ? (
          <img src={order.listing.heroImageUrl} alt={listingTitle ?? ""} loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-6 text-border" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span dir="ltr" className="truncate font-mono text-xs font-semibold text-primary">{order.betkRef}</span>
          <StatusBadge domain="order" status={order.status} label={statusLabel} />
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{listingTitle}</p>
        {storeName && <p className="truncate text-xs text-muted-foreground">{storeName}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <PriceBlock price={order.total} priceType="fixed" size="sm" currency={currency} />
          <span dir="ltr" className="text-xs text-muted-foreground">{date}</span>
        </div>
      </div>
    </Link>
  );
}
