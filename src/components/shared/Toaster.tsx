"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster — DS-REGEN restyle of the root toast host (brief §5.26):
 * bottom-centered, inverse fg/bg, radius-lg, shadow-lg. Supersedes
 * components/ui/sonner.tsx in the root layout (ui/* stays untouched —
 * just swap the layout import to this file). Toasts announce completed/
 * attempted actions only; decisions go through ConfirmDialog.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      dir="rtl"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-foreground group-[.toaster]:text-background group-[.toaster]:border-transparent group-[.toaster]:rounded-lg group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-background/70",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-background/15 group-[.toast]:text-background",
        },
      }}
      {...props}
    />
  );
}
