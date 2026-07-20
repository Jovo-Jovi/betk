import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Field — thin label + hint + error layout wrapper for the onboarding steps.
 *
 * Structural composition only (label/hint/error placement), NOT a styled
 * design-system component: it uses the same token utilities the existing feature
 * pages compose with (auth/register, account), so it introduces no new visual
 * language. The actual controls are always kit / ui primitives (Input, Textarea,
 * Toggle, ImageUploader). A genuinely new component/state → STOP-and-flag to
 * Claude Design (T00 gate), never invented here.
 */
/** Shared control classes for native `<select>` — matches the ui/input token set. */
export const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export interface FieldProps {
  htmlFor?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ htmlFor, label, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
