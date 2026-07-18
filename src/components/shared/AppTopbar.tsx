"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Bell, Moon, Sun, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * AppTopbar — sticky public/buyer topbar (brief §5.13). Net-new (DS-REGEN).
 * ب mark + plain-text "BETK" wordmark (logo system is PARTIAL — never add a
 * lockup here). Search pill hides ≤768px (MobileBottomNav's Search takes over).
 * Wire into src/app/(public) & (buyer) layouts; wrap onLogoClick with next/link.
 */
export interface AppTopbarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: (v: string) => void;
  /** Search placeholder. Default "ابحث في بيتك…". */
  searchPlaceholder?: string;
  showSearch?: boolean;
  /** Path to the ب mark asset. Default "/logo/beh.png". */
  logoSrc?: string;
  notifCount?: number;
  onNotifClick?: () => void;
  avatar?: string;
  onAvatarClick?: () => void;
  isDark?: boolean;
  onThemeToggle?: () => void;
  onLogoClick?: () => void;
  /** aria-labels (Arabic defaults). */
  notifLabel?: string;
  themeLabel?: string;
  accountLabel?: string;
  className?: string;
  /** CD-DELTA-1 (§5.13 amendment, signed off 2026-07-18): language toggle. */
  /** Current locale — the button shows the OTHER locale's glyph ("EN" when "ar", "ع" when "en"). Default "ar". */
  lang?: "ar" | "en";
  /** aria-label for the language toggle. Default "تغيير اللغة". */
  langLabel?: string;
  onLanguageToggle?: () => void;
}

export function AppTopbar({
  searchValue = "", onSearchChange, onSearchSubmit, searchPlaceholder = "ابحث في بيتك…", showSearch = true,
  logoSrc = "/logo/beh.png", notifCount = 0, onNotifClick, avatar, onAvatarClick, isDark = false, onThemeToggle, onLogoClick,
  notifLabel = "الإشعارات", themeLabel = "تبديل المظهر", accountLabel = "حسابي", className,
  lang = "ar", langLabel = "تغيير اللغة", onLanguageToggle,
}: AppTopbarProps) {
  return (
    <header className={cn("sticky top-0 z-50 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-card px-4 shadow-sm", className)}>
      <button type="button" onClick={onLogoClick} aria-label="BETK" className="inline-flex items-center gap-2">
        <img src={logoSrc} alt="" className="size-[34px] rounded-full object-cover" />
        <span className="font-display text-h3 font-extrabold text-primary">BETK</span>
      </button>
      {showSearch && (
        <form onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(searchValue); }} className="relative max-w-[560px] flex-1 max-md:hidden">
          <Search className="absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={searchValue} onChange={(e) => onSearchChange?.(e.target.value)} placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full bg-muted pe-4 ps-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
      )}
      <div className="ms-auto flex items-center gap-2">
        <button type="button" onClick={onLanguageToggle} aria-label={langLabel} className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="text-[13px] font-bold leading-none">{lang === "ar" ? "EN" : "ع"}</span>
        </button>
        <button type="button" onClick={onThemeToggle} aria-label={themeLabel} className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        <button type="button" onClick={onNotifClick} aria-label={notifLabel} className="relative flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="size-[19px]" />
          {notifCount > 0 && <span className="absolute end-2 top-1.5 size-2 rounded-full border-2 border-card bg-destructive" />}
        </button>
        <button type="button" onClick={onAvatarClick} aria-label={accountLabel} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
          <Avatar className="size-9">
            <AvatarImage src={avatar} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground"><User className="size-[18px]" /></AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
