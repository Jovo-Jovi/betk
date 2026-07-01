import * as React from "react";
import { cn } from "@/lib/utils";
import type { PriceType } from "@/constants/enums";

/**
 * PriceBlock — renders listings.price by price_type with ج.م (EGP).
 * The number is an LTR island in the display face. quote_only emits NO
 * number (price hidden) — "السعر عند الطلب".
 */
export interface PriceBlockProps {
  price?: number | null;
  priceType?: PriceType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const NUM: Record<string, string> = { sm: "text-[0.9375rem]", md: "text-xl", lg: "text-3xl" };
const UNIT: Record<string, string> = { sm: "text-xs", md: "text-[0.8125rem]", lg: "text-base" };

const fmt = (n?: number | null) => (n == null ? "" : new Intl.NumberFormat("en-EG").format(n));

export function PriceBlock({ price, priceType = "fixed", size = "md", className }: PriceBlockProps) {
  if (priceType === "quote_only") {
    return <span className={cn("font-display font-bold text-primary", NUM[size], className)}>السعر عند الطلب</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5", className)}>
      {priceType === "starting_from" && <span className={cn("font-medium text-muted-foreground", UNIT[size])}>يبدأ من</span>}
      <span className="inline-flex items-baseline gap-1">
        <span className={cn("font-display font-bold leading-none text-foreground", NUM[size])} dir="ltr">{fmt(price)}</span>
        <span className={cn("font-semibold text-foreground", UNIT[size])}>ج.م</span>
      </span>
      {priceType === "per_hour" && <span className={cn("font-medium text-muted-foreground", UNIT[size])}>/ ساعة</span>}
    </span>
  );
}
