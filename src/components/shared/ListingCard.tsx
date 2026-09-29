import * as React from "react";
import { cn } from "@/lib/utils";
import { Zap, ImageOff } from "lucide-react";
import { PriceBlock } from "./PriceBlock";
import { StarRating } from "./StarRating";
import { StockBadge } from "./StockBadge";
import { WishlistButton } from "./WishlistButton";
import type { PriceType } from "@/constants/enums";

/**
 * ListingCard — the core catalog tile. i18n: the "boost" badge label comes
 * in as a prop (Arabic default); title/store are data. Nested strings
 * (price qualifiers, stock, wishlist aria) are handled by the child
 * components' own i18n props — forward them via the pass-through props below
 * if you need to localize them here. CD-DELTA-2: wishlist aria-labels are now
 * forwardable via wishlistAddLabel / wishlistRemoveLabel (Arabic defaults
 * preserved) so the heart localizes under /en. Lifts shadow-sm → shadow-md (legacy shadow-card aliases retired per brief §3.4).
 * NOTE: swap the <img> for next/image once image domains are configured.
 */
export interface ListingCardProps {
  titleAr: string;
  image?: string;
  price?: number | null;
  priceType?: PriceType;
  storeName?: string;
  /**
   * CD-DELTA-6 (REG-72, §8a): public store route built by the page from
   * stores.slug. When set, storeName is a link — its own keyboard stop,
   * separate from the card's listing activation. Absent → current text behaviour.
   */
  storeHref?: string;
  rating?: number;
  reviews?: number;
  boosted?: boolean;
  /** Boost badge label. Default "مميّز". */
  boostLabel?: string;
  saved?: boolean;
  onToggleSave?: (next: boolean) => void;
  /** Wishlist heart aria-label when unsaved (forwarded to WishlistButton.addLabel). Default "أضف للمفضلة". */
  wishlistAddLabel?: string;
  /** Wishlist heart aria-label when saved (forwarded to WishlistButton.removeLabel). Default "إزالة من المفضلة". */
  wishlistRemoveLabel?: string;
  stockQty?: number | null;
  isMadeToOrder?: boolean;
  isService?: boolean;
  /**
   * CD-DELTA-6 (§8k): the card's own destination (listing route). When set,
   * the title renders as a real link whose hit area stretches over the card;
   * the store-name link and the wishlist button stay separate stops above it
   * (no nested links). Absent → current behaviour. onClick is unchanged.
   */
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function ListingCard({
  titleAr, image, price, priceType = "fixed", storeName, storeHref, rating, reviews,
  boosted, boostLabel = "مميّز", saved, onToggleSave, wishlistAddLabel = "أضف للمفضلة", wishlistRemoveLabel = "إزالة من المفضلة", stockQty, isMadeToOrder, isService, href, onClick, className,
}: ListingCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn("group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md", href && "focus-within:ring-2 focus-within:ring-ring", className)}
    >
      <div className="relative">
        <div className="flex aspect-square items-center justify-center bg-secondary">
          {image
            ? <img src={image} alt={titleAr} loading="lazy" className="size-full object-cover" />
            : <ImageOff className="size-10 text-border" />}
        </div>
        {boosted && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-bold text-accent-foreground">
            <Zap className="size-3" fill="currentColor" /> {boostLabel}
          </span>
        )}
        <span className="absolute end-2 top-2 z-10">
          <WishlistButton active={saved} onToggle={onToggleSave} overlay size="sm" addLabel={wishlistAddLabel} removeLabel={wishlistRemoveLabel} />
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-foreground">
          {href
            ? <a href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{titleAr}</a>
            : titleAr}
        </h3>
        <PriceBlock price={price} priceType={priceType} size="md" />
        <div className="flex items-center justify-between gap-2">
          {storeName && (storeHref
            ? <a href={storeHref} onClick={(e) => e.stopPropagation()} className="relative z-10 truncate rounded-sm text-xs text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{storeName}</a>
            : <span className="truncate text-xs text-muted-foreground">{storeName}</span>)}
          {typeof rating === "number" && <StarRating value={rating} size={13} count={reviews} />}
        </div>
        <StockBadge stockQty={stockQty} isMadeToOrder={isMadeToOrder} isService={isService} />
      </div>
    </div>
  );
}
