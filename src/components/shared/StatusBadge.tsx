import * as React from "react";
import { cn } from "@/lib/utils";
import { statusColorMap, type StatusDomain } from "@/constants/statusColors";

/**
 * StatusBadge — centralized enum → tinted pill. Colors come from
 * constants/statusColors.ts (the single source of truth); Arabic labels
 * live here. RTL-safe (logical gap/padding). Never hardcode status colors.
 */
const LABELS: Partial<Record<StatusDomain, Record<string, string>>> = {
  order:   { pending:"قيد الانتظار", confirmed:"مؤكد", preparing:"قيد التحضير", dispatched:"تم الشحن", delivered:"تم التسليم", cancelled:"ملغي", returned:"مرتجع" },
  seller:  { pending:"قيد المراجعة", active:"نشط", suspended:"موقوف", banned:"محظور" },
  payment: { pending:"بانتظار الدفع", confirmed:"تم الدفع", failed:"فشل الدفع", refunded:"مسترد" },
  listing: { draft:"مسودة", active:"منشور", sold_out:"نفد المخزون", paused:"متوقف", removed:"محذوف" },
  dispute: { submitted:"مُقدّم", under_review:"قيد المراجعة", awaiting_seller:"بانتظار البائع", resolved:"تم الحل", closed:"مغلق" },
  boost:   { pending_payment:"بانتظار الدفع", active:"مميّز", expired:"منتهي", cancelled:"ملغي" },
  payout:  { pending:"قيد الانتظار", processing:"قيد المعالجة", processed:"تم التحويل", rejected:"مرفوض" },
};

export interface StatusBadgeProps {
  domain?: StatusDomain;
  status: string;
  label?: string;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ domain = "order", status, label, dot = false, className }: StatusBadgeProps) {
  const pair = statusColorMap[domain]?.[status] ?? { bg: "bg-muted", fg: "text-muted-foreground" };
  const text = label ?? LABELS[domain]?.[status] ?? status;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", pair.bg, pair.fg, className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {text}
    </span>
  );
}
