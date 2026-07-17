"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ConsoleSidebar — 260px console navigation shell for the seller & admin
 * consoles (brief §5.15). Net-new (DS-REGEN). SellerSidebar/AdminSidebar are
 * aliases (same anatomy; sections differ per console). Off-canvas ≤768px:
 * `open` + `onClose` control it; the panel slides from inline-start
 * (translate mirrors via rtl:/ltr: variants — one of the brief's two
 * sanctioned physical-transform exceptions).
 */
export interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}
export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}
export interface ConsoleSidebarProps {
  /** Line under the BETK wordmark (e.g. store name / "لوحة الإدارة"). */
  subtitle?: string;
  sections?: SidebarSection[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Path to the ب mark asset. Default "/logo/beh.png". */
  logoSrc?: string;
  /** Off-canvas open state (≤768px; ignored on desktop). */
  open?: boolean;
  /** Backdrop tap / close on mobile. */
  onClose?: () => void;
  className?: string;
}

export function ConsoleSidebar({ subtitle, sections = [], activeId, onSelect, logoSrc = "/logo/beh.png", open = false, onClose, className }: ConsoleSidebarProps) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden />}
      <aside className={cn(
        "fixed bottom-0 top-0 z-40 w-[var(--sidebar-width)] overflow-y-auto border-e border-border bg-card transition-transform duration-200 motion-reduce:transition-none",
        "start-0 md:translate-x-0",
        !open && "max-md:rtl:translate-x-full max-md:ltr:-translate-x-full",
        className,
      )}>
        <div className="flex min-h-[var(--topbar-height)] items-center gap-2.5 border-b border-border px-4">
          <img src={logoSrc} alt="" className="size-8 rounded-full object-cover" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-base font-extrabold text-primary">BETK</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        </div>
        <div className="p-3">
          {sections.map((sec, si) => (
            <div key={si} className="mb-4">
              {sec.title && <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{sec.title}</div>}
              <div className="flex flex-col gap-0.5">
                {sec.items.map((it) => {
                  const active = it.id === activeId;
                  return (
                    <button
                      key={it.id} type="button" onClick={() => onSelect?.(it.id)} aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        active ? "bg-primary/10 font-semibold text-primary" : "font-medium text-foreground",
                      )}
                    >
                      <span className={cn("flex", !active && "opacity-70")}>{it.icon}</span>
                      <span className="flex-1">{it.label}</span>
                      {typeof it.badge === "number" && it.badge > 0 && (
                        <span dir="ltr" className="ms-auto rounded-full bg-destructive px-1.5 py-px font-mono text-[11px] font-bold text-destructive-foreground">{it.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

/** Seller console navigation — ConsoleSidebar with seller sections. */
export function SellerSidebar(props: ConsoleSidebarProps) { return <ConsoleSidebar {...props} />; }
/** Admin console navigation — ConsoleSidebar with grouped admin sections. */
export function AdminSidebar(props: ConsoleSidebarProps) { return <ConsoleSidebar {...props} />; }
