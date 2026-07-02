import * as React from "react";
import { cn } from "@/lib/utils";
import type { PriceType } from "@/constants/enums";

/**
 * PriceBlock — renders listings.price by price_type. i18n: currency + the
 * three qualifier strings come in as props (Arabic defaults). The number is
 * an LTR island in the display face. quote_only emits NO number (price hidden).
 */
export interface PriceBlockProps {
  price?: number | null;
  priceType?: PriceType;
  size?: "sm" | "md" | "lg";
  /** Currency unit shown after the number. Default "ج.م". */
  currency?: string;
  /** starting_from qualifier. Default "يبدأ من". */
  startingFromLabel?: string;
  /** per_hour suffix. Default "/ ساعة". */
  perHourLabel?: string;
  /** quote_only text (no price shown). Default "السعر عند الطلب". */
  quoteLabel?: string;
  className?: string;
}

const NUM: Record<string, string> = { sm: "text-[0.9375rem]", md: "text-xl", lg: "text-3xl" };
const UNIT: Record<string, string> = { sm: "text-xs", md: "text-[0.8125rem]", lg: "text-base" };

const fmt = (n?: number | null) => (n == null ? "" : new Intl.NumberFormat("en-EG").format(n));

export function PriceBlock({
  price, priceType = "fixed", size = "md",
  currency = "ج.م", startingFromLabel = "يبدأ من", perHourLabel = "/ ساعة", quoteLabel = "السعر عند الطلب",
  className,
}: PriceBlockProps) {
  if (priceType === "quote_only") {
    return <span className={cn("font-display font-bold text-primary", NUM[size], className)}>{quoteLabel}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5", className)}>
      {priceType === "starting_from" && <span className={cn("font-medium text-muted-foreground", UNIT[size])}>{startingFromLabel}</span>}
      <span className="inline-flex items-baseline gap-1">
        <span className={cn("font-display font-bold leading-none text-foreground", NUM[size])} dir="ltr">{fmt(price)}</span>
        <span className={cn("font-semibold text-foreground", UNIT[size])}>{currency}</span>
      </span>
      {priceType === "per_hour" && <span className={cn("font-medium text-muted-foreground", UNIT[size])}>{perHourLabel}</span>}
    </span>
  );
}
