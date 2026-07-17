import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SLABadge — response/fulfilment countdown pill (brief §5.23). The countdown
 * text is an LTR mono island. Net-new (DS-REGEN); level is derived by the
 * caller from the SLA deadline (safe > 24h, warning ≤ 24h, danger breached).
 */
export interface SLABadgeProps {
  level?: "safe" | "warning" | "danger";
  /** Countdown text, e.g. "18h 20m". Rendered as an LTR mono island. */
  children?: React.ReactNode;
  className?: string;
}

const TONE: Record<string, string> = {
  safe:    "bg-success/[0.12] text-success",
  warning: "bg-warning/15 text-warning-text",
  danger:  "bg-destructive/[0.12] text-destructive",
};

export function SLABadge({ level = "safe", children, className }: SLABadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", TONE[level] ?? TONE.safe, className)}>
      <span dir="ltr" className="font-mono">{children}</span>
    </span>
  );
}
