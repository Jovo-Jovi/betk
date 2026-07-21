"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tabs as BaseTabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * Tabs — segmented navigation (brief §5.12). Net-new (CD-DELTA-4, Phase-05 kit
 * gate). Two-layer: composes the VANILLA shadcn `ui/tabs` (Radix Tabs) via the
 * CLI (see CHANGELOG) so keyboard nav, roving focus, and controlled/uncontrolled
 * modes come from the primitive — never hand-rolled. Both §5.12 styles ship as
 * one component behind `variant`:
 *   • "underline" (default) → `.tabs`/`.tab`: flex, 2px bottom border, active =
 *     --primary text + --primary underline (border-b -mb-0.5 collapse).
 *   • "pill" → `.filter-tabs`/`.filter-tab`: rounded-full --card pills, active =
 *     --primary bg + --primary-foreground.
 * Labels are string props ({ id, label }); optional per-tab `count` renders a
 * badge slot (Listings Management shows per-status counts). Content panels are
 * OPTIONAL — pass TabsContent children for tabbed panels, or use bar-only
 * (read `onValueChange`) as the T03 status filter does. Token-only. RTL: Radix
 * inherits document `dir`; underline + scroll direction follow page direction.
 */
export interface TabItem {
  /** Stable value emitted by onValueChange and matched by TabsContent value. */
  id: string;
  /** Visible label (bilingual string). */
  label: string;
  /** Optional count/badge shown after the label. */
  count?: number | string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Controlled active id. */
  value?: string;
  /** Uncontrolled initial active id. */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** §5.12 style. Default "underline". */
  variant?: "underline" | "pill";
  /** Optional TabsContent panels; omit for bar-only usage. */
  children?: React.ReactNode;
  /** aria-label for the tablist. */
  ariaLabel?: string;
  className?: string;
  /** Extra classes on the tablist row. */
  listClassName?: string;
}

const LIST: Record<NonNullable<TabsProps["variant"]>, string> = {
  underline: "flex items-center gap-1 overflow-x-auto border-b-2 border-border",
  pill: "flex flex-wrap items-center gap-2",
};

const TRIGGER: Record<NonNullable<TabsProps["variant"]>, string> = {
  underline:
    "group -mb-0.5 inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary disabled:opacity-50",
  pill:
    "group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground disabled:opacity-50",
};

const BADGE: Record<NonNullable<TabsProps["variant"]>, string> = {
  underline:
    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-muted-foreground group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary",
  pill:
    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-muted-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground",
};

export function Tabs({
  tabs, value, defaultValue, onValueChange, variant = "underline", children, ariaLabel, className, listClassName,
}: TabsProps) {
  return (
    <BaseTabs
      value={value}
      defaultValue={defaultValue ?? tabs[0]?.id}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <TabsList aria-label={ariaLabel} className={cn(LIST[variant], listClassName)}>
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} disabled={t.disabled} className={TRIGGER[variant]}>
            <span>{t.label}</span>
            {t.count !== undefined && <span className={BADGE[variant]}>{t.count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </BaseTabs>
  );
}

export { TabsContent };
