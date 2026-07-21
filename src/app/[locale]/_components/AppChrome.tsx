"use client";

/**
 * AppChrome — wires the neutral DS shells (AppTopbar + MobileBottomNav) into the
 * (public) and (buyer) route-group layouts (DS-LAND, replaces the T09 topbar
 * placeholder). App-router-owned glue: the shells themselves are frozen,
 * callback-driven DS components — this file supplies their navigation + theme.
 *
 * Navigation goes through the locale-aware `@/i18n/navigation` router (typed
 * routes under [locale]; NOT bare next/link) so the current locale is preserved.
 * `activeId`/`activePath` derive from the current (locale-stripped) pathname.
 * Theme toggle is next-themes (same provider the Settings switcher uses).
 *
 * Composition only — no restyle. TODO(Phase 03 T02+): pass real search/notif
 * state + avatar as those data sources land.
 *
 * PERF-01 / REG-38: the locale toggle (`onLanguageToggle` below) drives a full
 * server round-trip (`router.replace` remounts the whole `[locale]` subtree),
 * unlike the theme toggle's pure-client class swap — DIAG-PERF-01 A1 found
 * this "feels dead" with no visible pending state. Wrapped in `useTransition`
 * so `isLocalePending` is true for the duration of that navigation; applied as
 * a token-only `opacity-60` + `aria-busy` on this component's own wrapper (the
 * only DOM this app-layer file owns). **STOP-and-flag (CD-DELTA-4 candidate):**
 * `AppTopbar`'s language-toggle `<button>` (components/shared, frozen) has NO
 * `disabled`/`className` passthrough on that specific button — its
 * `AppTopbarProps` only exposes `onLanguageToggle`/`lang`/`langLabel` — so the
 * button itself cannot render `aria-busy`/`opacity-60`/`cursor-progress`
 * directly from here without editing `components/shared` (forbidden). The
 * click handler still no-ops while pending (no duplicate navigations) and the
 * wrapper dim gives a real, if indirect, pending affordance.
 */

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Home, Search, Heart, MessageSquare, User } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { AppTopbar, MobileBottomNav } from "@/components/shared";
import type { BottomNavItem } from "@/components/shared/MobileBottomNav";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

/** Bottom-nav item id → canonical (locale-neutral) route. */
const NAV_ROUTES: Record<string, string> = {
  home: routes.home,
  search: routes.search,
  wishlist: routes.buyer.wishlist,
  inbox: routes.buyer.inbox,
  account: routes.buyer.account,
};

/** Bottom-nav icons by id (label text is supplied by next-intl, below). */
const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <Home className="size-[22px]" />,
  search: <Search className="size-[22px]" />,
  wishlist: <Heart className="size-[22px]" />,
  inbox: <MessageSquare className="size-[22px]" />,
  account: <User className="size-[22px]" />,
};

/** Derive the active nav id from the locale-stripped pathname. */
function activeIdFromPath(pathname: string): string {
  if (pathname === routes.home) return "home";
  if (pathname.startsWith(routes.search)) return "search";
  if (pathname.startsWith(routes.buyer.wishlist)) return "wishlist";
  if (pathname.startsWith(routes.buyer.inbox)) return "inbox";
  if (pathname.startsWith(routes.buyer.account)) return "account";
  return "";
}

export function AppChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [isLocalePending, startLocaleTransition] = useTransition();
  const t = useTranslations("chrome");

  const isDark = resolvedTheme === "dark";
  const activeId = activeIdFromPath(pathname);
  const otherLocale: AppLocale = locale === "ar" ? "en" : "ar";

  // Locale-aware bottom-nav items: default icons + next-intl labels (ar/en).
  const navItems: BottomNavItem[] = ["home", "search", "wishlist", "inbox", "account"].map((id) => ({
    id,
    icon: NAV_ICONS[id],
    label: t(`nav.${id}`),
  }));

  function handleLanguageToggle() {
    if (isLocalePending) return;
    startLocaleTransition(() => {
      router.replace(pathname, { locale: otherLocale });
    });
  }

  return (
    <div
      aria-busy={isLocalePending}
      className={cn(isLocalePending && "pointer-events-none opacity-60 transition-opacity duration-200")}
    >
      <AppTopbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={(v) =>
          router.push(v ? `${routes.search}?q=${encodeURIComponent(v)}` : routes.search)
        }
        logoSrc="/logo/beh-64.png"
        searchPlaceholder={t("searchPlaceholder")}
        notifLabel={t("notifications")}
        themeLabel={t("theme")}
        accountLabel={t("account")}
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        lang={locale}
        langLabel={t("language")}
        onLanguageToggle={handleLanguageToggle}
        onLogoClick={() => router.push(routes.home)}
        onNotifClick={() => router.push(routes.buyer.notifications)}
        onAvatarClick={() => router.push(routes.buyer.account)}
      />
      <MobileBottomNav
        items={navItems}
        activeId={activeId}
        onSelect={(id) => {
          const to = NAV_ROUTES[id];
          if (to) router.push(to);
        }}
      />
    </div>
  );
}
