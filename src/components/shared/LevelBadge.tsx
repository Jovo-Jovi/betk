import * as React from "react";
import { cn } from "@/lib/utils";
import type { SellerLevel } from "@/constants/enums";

/**
 * LevelBadge — seller tier pill (Bronze/Silver/Gold) from seller_profiles.level.
 * i18n: tier labels come in via `labels` (Arabic default). Metallic colors
 * come from the --level-* tokens (no raw HSL).
 */
const CLS: Record<SellerLevel, string> = {
  bronze: "bg-level-bronze-bg text-level-bronze-fg ring-level-bronze-ring",
  silver: "bg-level-silver-bg text-level-silver-fg ring-level-silver-ring",
  gold:   "bg-level-gold-bg text-level-gold-fg ring-level-gold-ring",
};

const DEFAULT_LABELS: Record<SellerLevel, string> = { bronze: "برونزي", silver: "فضي", gold: "ذهبي" };

export interface LevelBadgeProps {
  level?: SellerLevel;
  showLabel?: boolean;
  /** Tier → label map override. Defaults to Arabic. */
  labels?: Partial<Record<SellerLevel, string>>;
  className?: string;
}

export function LevelBadge({ level = "bronze", showLabel = true, labels, className }: LevelBadgeProps) {
  const text = labels?.[level] ?? DEFAULT_LABELS[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full text-xs font-bold leading-tight ring-1 ring-inset", CLS[level] ?? CLS.bronze, showLabel ? "px-2 py-0.5" : "p-1", className)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2l2.2 4.5 5 .7-3.6 3.5.85 4.95L12 17.8l-4.45 2.35.85-4.95L4.8 7.2l5-.7z" fill="currentColor" />
      </svg>
      {showLabel && text}
    </span>
  );
}
