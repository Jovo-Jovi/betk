import * as React from "react";
import { cn } from "@/lib/utils";
import { statusColorMap, type StatusDomain } from "@/constants/statusColors";

/**
 * StatusBadge — centralized enum → tinted pill. Colors come from
 * constants/statusColors.ts (single source of truth). i18n: labels are no
 * longer baked — pass `label` (single) or a `labels` map to override. The
 * Arabic map remains the sensible DEFAULT so nothing regresses if unspecified.
 *
 * BL-04-FIX: kept `Partial<...>` (restores main's exact pre-DS-I18N contract)
 * because this map has never covered the `flag` StatusDomain (moderation
 * flags — pending/reviewed/actioned/dismissed) in either the old or the
 * DS-I18N version. `flag` has colors in constants/statusColors.ts but no
 * Arabic default labels yet — pending a Design decision (admin/moderation
 * phase). Do NOT author flag labels here without Design sign-off.
 */
const DEFAULT_LABELS: Partial<Record<StatusDomain, Record<string, string>>> = {
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
  /** Single-instance label override (wins over `labels`). */
  label?: string;
  /** Full/partial label map override, keyed [domain][status]. Defaults to Arabic. */
  labels?: Partial<Record<StatusDomain, Record<string, string>>>;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ domain = "order", status, label, labels, dot = false, className }: StatusBadgeProps) {
  const pair = statusColorMap[domain]?.[status] ?? { bg: "bg-muted", fg: "text-muted-foreground" };
  const text = label ?? labels?.[domain]?.[status] ?? DEFAULT_LABELS[domain]?.[status] ?? status;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", pair.bg, pair.fg, className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {text}
    </span>
  );
}
