import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "./StarRating";
import { LevelBadge } from "./LevelBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { FollowButton } from "./FollowButton";
import type { SellerLevel } from "@/constants/enums";

/**
 * StoreCard — storefront summary (Homepage featured row, Following, Search).
 * Cover strip + overlapping avatar, name, verified + level, rating, follow.
 */
export interface StoreCardProps {
  name: string;
  avatar?: string;
  cover?: string;
  level?: SellerLevel;
  verified?: boolean;
  rating?: number;
  reviews?: number;
  governorate?: string;
  listingCount?: number;
  following?: boolean;
  onToggleFollow?: (next: boolean) => void;
  className?: string;
}

export function StoreCard({ name, avatar, cover, level, verified, rating, reviews, governorate, listingCount, following, onToggleFollow, className }: StoreCardProps) {
  return (
    <div className={cn("flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card", className)}>
      <div
        className="h-16 bg-muted"
        style={cover ? { background: `center/cover no-repeat url(${cover})` } : { background: "linear-gradient(120deg, hsl(var(--primary)/0.18), hsl(var(--accent)/0.14))" }}
      />
      <div className="-mt-7 flex flex-col gap-2.5 px-3.5 pb-3.5">
        <Avatar className="size-14 border-[3px] border-card">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="font-display text-xl font-bold">{name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-base font-bold text-foreground">{name}</span>
            {verified && <VerifiedBadge showLabel={false} size={16} />}
            {level && <LevelBadge level={level} showLabel={false} />}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {typeof rating === "number" && <StarRating value={rating} size={13} count={reviews} />}
            {governorate && <span>{governorate}</span>}
            {typeof listingCount === "number" && <span>{listingCount} إعلان</span>}
          </div>
        </div>
        <FollowButton following={following} onToggle={onToggleFollow} size="sm" />
      </div>
    </div>
  );
}
