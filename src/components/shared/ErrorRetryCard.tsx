import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * ErrorRetryCard — section-level error scoped to the failed region. i18n:
 * both the message (already a prop) and the retry label come in as props with
 * Arabic defaults. Never expose SQL/RLS/internal reasons (UI_STATE_STANDARDS §6).
 */
export interface ErrorRetryCardProps {
  /** Non-technical message. Default "حدث خطأ ما، يرجى المحاولة مجدداً.". */
  message?: string;
  onRetry?: () => void;
  /** Retry button label. Default "إعادة المحاولة". */
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorRetryCard({ message = "حدث خطأ ما، يرجى المحاولة مجدداً.", onRetry, retryLabel = "إعادة المحاولة", compact = false, className }: ErrorRetryCardProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 text-center", compact ? "p-5" : "px-6 py-8", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-[22px]" />
      </span>
      <p className="max-w-xs text-[0.9375rem] font-semibold leading-relaxed text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-[15px]" /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
