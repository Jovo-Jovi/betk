"use client";

/**
 * StorefrontTabs — client tab switcher for the storefront (Listings / Reviews /
 * About). Phase 03 / T06 (composition only — there is NO shadcn Tabs primitive
 * in components/ui, and this task must NOT add one; git diff -- components/ui
 * stays empty). Hand-rolled with the design tokens, RTL-safe (logical utilities).
 *
 * Each panel's `content` is server-rendered (RSC) and passed in as a ReactNode
 * slot — the standard "client shell wrapping server content" pattern. ALL
 * panels stay mounted (inactive ones `hidden`) so the server-rendered grid /
 * reviews / about markup ships in the initial HTML (SEO + no client refetch)
 * and tab switches are instant.
 *
 * `defaultTabId` lets the RSC restore the active tab from the `?tab=` URL param
 * after a Listings "load more" navigation (which appends `&tab=listings`), so
 * paginating never bounces the user back to the first tab.
 */

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StorefrontTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface StorefrontTabsProps {
  tabs: StorefrontTab[];
  defaultTabId?: string;
}

export function StorefrontTabs({ tabs, defaultTabId }: StorefrontTabsProps) {
  const initial = tabs.some((t) => t.id === defaultTabId) ? defaultTabId! : tabs[0]!.id;
  const [active, setActive] = useState(initial);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`storefront-panel-${tab.id}`}
              id={`storefront-tab-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`storefront-panel-${tab.id}`}
          aria-labelledby={`storefront-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
