"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Alert as BaseAlert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

/**
 * Alert — inline informational / warning banner (brief §5.36). Net-new
 * (CD-DELTA-3, Phase-04 kit gate). Two-layer: composes the VANILLA shadcn
 * `ui/alert` (role="alert" + title/description structure) via the CLI (see
 * CHANGELOG); the shared layer adds the four brief tones the base lacks —
 * info (on the additive `--info` pair, §2.4b), success, warning (paired with
 * `--warning-text`), destructive — plus a default per-variant icon and an
 * optional dismiss button. Tones reuse the exact token classes already used by
 * SLABadge / statusColors. Copy (title/message/dismissLabel) is bilingual props.
 */
export type AlertVariant = "info" | "success" | "warning" | "destructive";

export interface AlertProps {
  /** Tone. Default "info". */
  variant?: AlertVariant;
  title?: string;
  /** Body text; or pass `children` for rich content. */
  message?: string;
  children?: React.ReactNode;
  /** Override the default per-variant leading icon. */
  icon?: React.ReactNode;
  /** When provided, renders a dismiss button that calls this. */
  onDismiss?: () => void;
  /** aria-label for the dismiss button. Default "إغلاق". */
  dismissLabel?: string;
  className?: string;
}

const TONE: Record<AlertVariant, string> = {
  info: "border-info/20 bg-info/10 text-info",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/15 text-warning-text",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
};

const DEFAULT_ICON: Record<AlertVariant, React.ReactNode> = {
  info: <Info size={18} />,
  success: <CheckCircle2 size={18} />,
  warning: <AlertTriangle size={18} />,
  destructive: <XCircle size={18} />,
};

export function Alert({
  variant = "info", title, message, children, icon, onDismiss, dismissLabel = "إغلاق", className,
}: AlertProps) {
  return (
    <BaseAlert className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-sm", TONE[variant], className)}>
      <span className="mt-0.5 shrink-0">{icon ?? DEFAULT_ICON[variant]}</span>
      <div className="min-w-0 flex-1">
        {title && <AlertTitle className="font-semibold">{title}</AlertTitle>}
        {(children ?? message) && <AlertDescription>{children ?? message}</AlertDescription>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="mt-0.5 shrink-0 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </BaseAlert>
  );
}
