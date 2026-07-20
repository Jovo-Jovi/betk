"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/**
 * Toggle — labelled on/off switch (brief §5.9). Net-new (CD-DELTA-3, Phase-04
 * kit gate). Two-layer: composes the VANILLA shadcn `ui/switch` (Radix) for
 * behavior + a11y — never hand-rolled. The base lands byte-vanilla via the CLI
 * (see CHANGELOG); ALL §5.9 styling lives here as className overrides:
 *   • off track → `--border` (data-[state=unchecked]:bg-border);
 *   • RTL knob travel → the whole control mirrors under [dir=rtl] (rtl:-scale-x-100),
 *     so the thumb moves start→end without touching the base's internal thumb.
 * The shadcn default dims already match §5.9 (44×24 track, 20×20 knob).
 * `label` is a bilingual string prop; when omitted, pass `ariaLabel`.
 */
export interface ToggleProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label rendered inline-start of the switch (bilingual string). */
  label?: string;
  /** aria-label used only when there is no visible `label`. */
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({ checked, onCheckedChange, label, ariaLabel, disabled, id, className }: ToggleProps) {
  const control = (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      className={cn("data-[state=unchecked]:bg-border rtl:-scale-x-100", !label && className)}
    />
  );
  if (!label) return control;
  return (
    <label htmlFor={id} className={cn("flex items-center justify-between gap-3 text-sm font-medium text-foreground", className)}>
      <span>{label}</span>
      {control}
    </label>
  );
}
