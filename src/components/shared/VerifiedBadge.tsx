import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VerifiedBadge — trust marker for seller_profiles.is_verified. BETK green check.
 */
export interface VerifiedBadgeProps {
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export function VerifiedBadge({ showLabel = true, size = 16, className }: VerifiedBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold leading-tight text-primary", className)} title="بائع موثّق">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 1.8l2.4 1.75 2.96-.02 .9 2.82 2.4 1.74-.93 2.81.93 2.81-2.4 1.74-.9 2.82-2.96-.02L12 22.2l-2.4-1.75-2.96.02-.9-2.82-2.4-1.74.93-2.81-.93-2.81 2.4-1.74.9-2.82 2.96.02z" fill="currentColor" />
        <path d="M8.4 12l2.4 2.4 4.8-4.8" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {showLabel && "بائع موثّق"}
    </span>
  );
}
