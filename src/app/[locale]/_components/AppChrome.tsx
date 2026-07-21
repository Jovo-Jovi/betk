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
 * PERF-01 / REG-38 / CD-DELTA-4: the locale toggle (`onLanguageToggle` below)
 * drives a full server round-trip (`router.replace` remounts the whole
 * `[locale]` subtree), unlike the theme toggle's pure-client class swap —
 * DIAG-PERF-01 A1 found this "feels dead" with no visible pending state. It is
 * wrapped in `useTransition` so `isLocalePending` is true for that navigation's
 * duration and passed to `AppTopbar` as `langPending` — the CD-DELTA-4 additive
 * prop that renders the pending affordance (disabled + aria-busy + opacity-60 +
 * cursor-progress) ON THE BUTTON ITSELF, closing the PERF-01 STOP-and-flag. The
 * earlier workaround (a dimmed `pointer-events-none` wrapper `<div>` around the
 * whole chrome) is therefore removed. A second `useTransition` drives the shared
 * `RouteProgress` top bar (REG-38b) for in-chrome navigations; it renders null
 * at rest.
 */

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { Home, Search, Heart, MessageSquare, User } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { AppTopbar, MobileBottomNav, RouteProgress } from "@/components/shared";
import type { BottomNavItem } from "@/components/shared/MobileBottomNav";
import { routes } from "@/constants/routes";

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
  const [isRoutePending, startRouteTransition] = useTransition();
  const t = useTranslations("chrome");
  const tCommon = useTranslations("common");

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
    <>
      <RouteProgress active={isLocalePending || isRoutePending} ariaLabel={tCommon("loading")} />
      <AppTopbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={(v) =>
          startRouteTransition(() =>
            router.push(v ? `${routes.search}?q=${encodeURIComponent(v)}` : routes.search)
          )
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
        langPending={isLocalePending}
        onLogoClick={() => startRouteTransition(() => router.push(routes.home))}
        onNotifClick={() => startRouteTransition(() => router.push(routes.buyer.notifications))}
        onAvatarClick={() => startRouteTransition(() => router.push(routes.buyer.account))}
      />
      <MobileBottomNav
        items={navItems}
        activeId={activeId}
        onSelect={(id) => {
          const to = NAV_ROUTES[id];
          if (to) startRouteTransition(() => router.push(to));
        }}
      />
    </>
  );
}
