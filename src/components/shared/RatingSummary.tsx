import * as React from "react";
import { cn } from "@/lib/utils";
import { StarRating } from "./StarRating";

/**
 * RatingSummary — average + 5→1 distribution bars from rating_aggregates.
 * i18n: the review-count line comes in as a template prop ("{count} تقييم"
 * default); "{count}" is interpolated with total. Bars use the --star token.
 */
export interface RatingSummaryProps {
  average?: number;
  total?: number;
  distribution?: Record<number, number>;
  compact?: boolean;
  /** Review-count line; "{count}" → total. Default "{count} تقييم". */
  reviewsLabel?: string;
  className?: string;
}

export function RatingSummary({ average = 0, total = 0, distribution = {}, compact = false, reviewsLabel = "{count} تقييم", className }: RatingSummaryProps) {
  const rows = [5, 4, 3, 2, 1];
  const max = Math.max(1, ...rows.map((r) => distribution[r] || 0));
  return (
    <div className={cn("flex", compact ? "items-center gap-4" : "items-start gap-6", className)}>
      <div className="flex min-w-[88px] flex-col items-center gap-1">
        <span className="font-display text-4xl font-bold leading-none text-foreground" dir="ltr">{average.toFixed(1)}</span>
        <StarRating value={average} size={15} />
        <span className="text-[0.8125rem] text-muted-foreground">{reviewsLabel.replace("{count}", String(total))}</span>
      </div>
      {!compact && (
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          {rows.map((r) => {
            const c = distribution[r] || 0;
            return (
              <div key={r} className="flex items-center gap-2">
                <span className="w-3 text-center text-xs text-muted-foreground">{r}</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-star" style={{ width: `${(c / max) * 100}%` }} />
                </div>
                <span className="w-7 text-start font-mono text-xs text-muted-foreground" dir="ltr">{c}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
