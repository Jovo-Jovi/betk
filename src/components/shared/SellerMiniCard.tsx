import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "./StarRating";
import { LevelBadge } from "./LevelBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import type { SellerLevel } from "@/constants/enums";

/**
 * SellerMiniCard — compact seller identity row (Listing Detail, inquiry,
 * order context). i18n: the response-time line comes in as a template prop
 * ("يرد خلال {hours} ساعة" default); "{hours}" → responseHours.
 * Composes ui/avatar + trust badges.
 */
export interface SellerMiniCardProps {
  name: string;
  avatar?: string;
  level?: SellerLevel;
  verified?: boolean;
  rating?: number;
  reviews?: number;
  responseHours?: number;
  /** Response-time line; "{hours}" → responseHours. Default "يرد خلال {hours} ساعة". */
  responseLabel?: string;
  governorate?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SellerMiniCard({ name, avatar, level, verified, rating, reviews, responseHours, responseLabel = "يرد خلال {hours} ساعة", governorate, action, className }: SellerMiniCardProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-card p-3", className)}>
      <Avatar className="size-12">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="font-display font-bold">{name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-[0.9375rem] font-bold text-foreground">{name}</span>
          {verified && <VerifiedBadge showLabel={false} size={15} />}
          {level && <LevelBadge level={level} showLabel={false} />}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          {typeof rating === "number" && <StarRating value={rating} size={13} count={reviews} />}
          {typeof responseHours === "number" && <span>{responseLabel.replace("{hours}", String(responseHours))}</span>}
          {governorate && <span>{governorate}</span>}
        </div>
      </div>
      {action}
    </div>
  );
}
