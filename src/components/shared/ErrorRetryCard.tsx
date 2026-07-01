import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * ErrorRetryCard — section-level error scoped to the failed region so the
 * rest of the page survives. Non-technical Arabic copy + retry. Per
 * UI_STATE_STANDARDS §6 — never expose SQL/RLS/internal reasons.
 */
export interface ErrorRetryCardProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorRetryCard({ message = "حدث خطأ ما، يرجى المحاولة مجدداً.", onRetry, compact = false, className }: ErrorRetryCardProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 text-center", compact ? "p-5" : "px-6 py-8", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-[22px]" />
      </span>
      <p className="max-w-xs text-[0.9375rem] font-semibold leading-relaxed text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-[15px]" /> إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
