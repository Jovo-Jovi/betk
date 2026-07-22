"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * RouteProgress — global route-transition indicator (brief §5.24 extension).
 * Net-new (CD-DELTA-4, REG-38b — ADOPTED). A thin fixed top bar with an
 * indeterminate --primary segment; sits at z-60 above the topbar (z-50). The
 * app drives `active` from router transition state (Next.js router events /
 * useLinkStatus). Renders nothing when inactive → zero cost at rest and no
 * visual change on non-transitioning pages. Token-only (bg-primary / -primary/15);
 * the keyframe animates transform only (no color literal). RTL: the segment
 * travels inline-start→inline-end following page direction via a rtl reverse.
 */
export interface RouteProgressProps {
  /** When true, the bar is mounted and animating. */
  active?: boolean;
  /** aria-label (bilingual string). Default "جارٍ التحميل". */
  ariaLabel?: string;
  className?: string;
}

export function RouteProgress({ active = false, ariaLabel = "جارٍ التحميل", className }: RouteProgressProps) {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn("fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-primary/15", className)}
    >
      <style>{"@keyframes betk-route-progress{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}"}</style>
      <span
        className="block h-full w-1/4 rounded-full bg-primary rtl:[animation-direction:reverse]"
        style={{
          animationName: "betk-route-progress",
          animationDuration: "1.1s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />
    </div>
  );
}
