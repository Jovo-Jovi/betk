import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StarRating — 1–5 gold stars with fractional fill. Read-only or interactive.
 * Stars are an LTR island so they read left→right inside the RTL page.
 * Gold = text-star token; empty = text-border.
 */
export interface StarRatingProps {
  value?: number;
  count?: number;
  size?: number;
  onRate?: (n: number) => void;
  className?: string;
}

const STAR_PATH = "M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.4l-5.8 3.05 1.1-6.47-4.7-4.58 6.5-.95z";

export function StarRating({ value = 0, count, size = 16, onRate, className }: StarRatingProps) {
  const interactive = typeof onRate === "function";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex gap-0.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = Math.max(0, Math.min(1, value - (n - 1)));
          return (
            <span
              key={n}
              onClick={interactive ? () => onRate?.(n) : undefined}
              className={cn("relative inline-block", interactive && "cursor-pointer")}
              style={{ width: size, height: size }}
            >
              <svg viewBox="0 0 24 24" className="absolute inset-0 text-border" width={size} height={size}>
                <path d={STAR_PATH} fill="currentColor" />
              </svg>
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" className="text-star" width={size} height={size}>
                  <path d={STAR_PATH} fill="currentColor" />
                </svg>
              </span>
            </span>
          );
        })}
      </span>
      {typeof count === "number" && (
        <span className="font-mono text-[0.8125rem] text-muted-foreground" dir="ltr">({count})</span>
      )}
    </span>
  );
}
