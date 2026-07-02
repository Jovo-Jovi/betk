import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StockBadge — availability pill derived from a listing's stock fields.
 * i18n: state labels + the low-stock "remaining" line come in as props
 * (`labels`, `remainingLabel`). Arabic remains the sensible default.
 * Warning text uses the --warning-text token (no raw HSL).
 */
type StockState = "in_stock" | "low" | "sold_out" | "made_to_order" | "service";

const TONE: Record<StockState, string> = {
  in_stock:      "bg-success/15 text-success",
  low:           "bg-warning/[0.18] text-warning-text",
  sold_out:      "bg-warning/[0.18] text-warning-text",
  made_to_order: "bg-primary/10 text-primary",
  service:       "bg-primary/10 text-primary",
};

const DEFAULT_LABELS: Record<StockState, string> = {
  in_stock: "متوفر", low: "كمية محدودة", sold_out: "نفد المخزون", made_to_order: "حسب الطلب", service: "متاح",
};

export interface StockBadgeProps {
  state?: StockState;
  stockQty?: number | null;
  lowStockThreshold?: number;
  isMadeToOrder?: boolean;
  isService?: boolean;
  /** Single-instance label override. */
  label?: string;
  /** State → label map override. Defaults to Arabic. */
  labels?: Partial<Record<StockState, string>>;
  /** Low-stock template; "{qty}" is replaced with the remaining count. Default "باقي {qty}". */
  remainingLabel?: string;
  className?: string;
}

function derive(p: StockBadgeProps): StockState {
  if (p.state) return p.state;
  if (p.isService) return "service";
  if (p.isMadeToOrder) return "made_to_order";
  if (typeof p.stockQty === "number") {
    if (p.stockQty <= 0) return "sold_out";
    if (p.stockQty <= (p.lowStockThreshold ?? 3)) return "low";
    return "in_stock";
  }
  return "in_stock";
}

export function StockBadge(props: StockBadgeProps) {
  const { label, labels, remainingLabel = "باقي {qty}", className } = props;
  const key = derive(props);
  const showQty = key === "low" && typeof props.stockQty === "number";
  const text = label
    ?? (showQty
      ? remainingLabel.replace("{qty}", String(props.stockQty))
      : labels?.[key] ?? DEFAULT_LABELS[key]);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", TONE[key], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
