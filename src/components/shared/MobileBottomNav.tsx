"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Home, Search, Heart, MessageSquare, User } from "lucide-react";

/**
 * MobileBottomNav — fixed 60px bottom navigation, ≤768px (brief §5.14).
 * Net-new (DS-REGEN). Give the page shell pb-[var(--bottom-nav-height)]
 * when mounted. Items are props (Arabic default labels); active by route id.
 */
export interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

const DEFAULT_ITEMS: BottomNavItem[] = [
  { id: "home", icon: <Home className="size-[22px]" />, label: "الرئيسية" },
  { id: "search", icon: <Search className="size-[22px]" />, label: "بحث" },
  { id: "wishlist", icon: <Heart className="size-[22px]" />, label: "المفضلة" },
  { id: "inbox", icon: <MessageSquare className="size-[22px]" />, label: "الرسائل" },
  { id: "account", icon: <User className="size-[22px]" />, label: "حسابي" },
];

export interface MobileBottomNavProps {
  items?: BottomNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

export function MobileBottomNav({ items = DEFAULT_ITEMS, activeId = "home", onSelect, className }: MobileBottomNavProps) {
  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-40 flex h-[var(--bottom-nav-height)] border-t border-border bg-card md:hidden", className)}>
      {items.map((it) => (
        <button
          key={it.id} type="button" onClick={() => onSelect?.(it.id)} aria-current={it.id === activeId ? "page" : undefined}
          className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", it.id === activeId ? "text-primary" : "text-muted-foreground")}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
