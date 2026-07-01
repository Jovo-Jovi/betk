import * as React from "react";
import { cn } from "@/lib/utils";
import { Zap, ImageOff } from "lucide-react";
import { PriceBlock } from "./PriceBlock";
import { StarRating } from "./StarRating";
import { StockBadge } from "./StockBadge";
import { WishlistButton } from "./WishlistButton";
import type { PriceType } from "@/constants/enums";

/**
 * ListingCard — the core catalog tile. Square hero, boost badge (start/top)
 * when boosted, wishlist toggle (end/top), title_ar (2-line clamp), price,
 * store, rating, stock. Lifts shadow-card → shadow-card-hover on hover.
 * NOTE: swap the <img> for next/image once image domains are configured.
 */
export interface ListingCardProps {
  titleAr: string;
  image?: string;
  price?: number | null;
  priceType?: PriceType;
  storeName?: string;
  rating?: number;
  reviews?: number;
  boosted?: boolean;
  saved?: boolean;
  onToggleSave?: (next: boolean) => void;
  stockQty?: number | null;
  isMadeToOrder?: boolean;
  isService?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ListingCard({
  titleAr, image, price, priceType = "fixed", storeName, rating, reviews,
  boosted, saved, onToggleSave, stockQty, isMadeToOrder, isService, onClick, className,
}: ListingCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn("group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover", className)}
    >
      <div className="relative">
        <div className="flex aspect-square items-center justify-center bg-secondary">
          {image
            ? <img src={image} alt={titleAr} loading="lazy" className="size-full object-cover" />
            : <ImageOff className="size-10 text-border" />}
        </div>
        {boosted && (
          <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-bold text-accent-foreground">
            <Zap className="size-3" fill="currentColor" /> مميّز
          </span>
        )}
        <span className="absolute end-2 top-2">
          <WishlistButton active={saved} onToggle={onToggleSave} overlay size="sm" />
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug text-foreground">{titleAr}</h3>
        <PriceBlock price={price} priceType={priceType} size="md" />
        <div className="flex items-center justify-between gap-2">
          {storeName && <span className="truncate text-xs text-muted-foreground">{storeName}</span>}
          {typeof rating === "number" && <StarRating value={rating} size={13} count={reviews} />}
        </div>
        <StockBadge stockQty={stockQty} isMadeToOrder={isMadeToOrder} isService={isService} />
      </div>
    </div>
  );
}
