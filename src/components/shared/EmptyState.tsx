import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PackageOpen, SearchX, CheckCircle2, Heart } from "lucide-react";

/**
 * EmptyState — universal empty placeholder: one plain-Arabic line + a single
 * CTA. default = no-data-yet; filtered = no-results (clear filters); positive
 * = admin "queue is clear"; wishlist = saved-empty. Per UI_STATE_STANDARDS §6.
 */
export interface EmptyStateProps {
  message?: string;
  hint?: string;
  variant?: "default" | "filtered" | "positive" | "wishlist";
  action?: { label: string; onClick: () => void };
  className?: string;
}

const ICONS = {
  default: PackageOpen,
  filtered: SearchX,
  positive: CheckCircle2,
  wishlist: Heart,
} as const;

export function EmptyState({ message = "لا توجد بيانات", hint, variant = "default", action, className }: EmptyStateProps) {
  const Icon = ICONS[variant];
  const positive = variant === "positive";
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      <span className={cn("flex size-14 items-center justify-center rounded-full", positive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
        <Icon className="size-6" />
      </span>
      <div className="flex max-w-xs flex-col gap-1">
        <p className="font-display text-base font-bold text-foreground">{message}</p>
        {hint && <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {action && (
        <Button variant={variant === "filtered" ? "outline" : "default"} onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
