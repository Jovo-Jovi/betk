import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StockBadge — availability pill derived from a listing's stock fields.
 * product (in_stock/low/sold_out) · service · made_to_order.
 * Warning text uses the --warning-text token (no raw HSL).
 */
type StockState = "in_stock" | "low" | "sold_out" | "made_to_order" | "service";

const TONE: Record<StockState, { cls: string; ar: string }> = {
  in_stock:      { cls: "bg-success/15 text-success",          ar: "متوفر" },
  low:           { cls: "bg-warning/[0.18] text-warning-text", ar: "كمية محدودة" },
  sold_out:      { cls: "bg-warning/[0.18] text-warning-text", ar: "نفد المخزون" },
  made_to_order: { cls: "bg-primary/10 text-primary",          ar: "حسب الطلب" },
  service:       { cls: "bg-primary/10 text-primary",          ar: "متاح" },
};

export interface StockBadgeProps {
  state?: StockState;
  stockQty?: number | null;
  lowStockThreshold?: number;
  isMadeToOrder?: boolean;
  isService?: boolean;
  label?: string;
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
  const key = derive(props);
  const t = TONE[key];
  const showQty = key === "low" && typeof props.stockQty === "number";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", t.cls, props.className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {props.label ?? (showQty ? `باقي ${props.stockQty}` : t.ar)}
    </span>
  );
}
