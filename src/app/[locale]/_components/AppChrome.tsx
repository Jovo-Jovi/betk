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
 */

import { useState } from "react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "@/i18n/navigation";
import { AppTopbar, MobileBottomNav } from "@/components/shared";
import { routes } from "@/constants/routes";

/** Bottom-nav item id → canonical (locale-neutral) route. */
const NAV_ROUTES: Record<string, string> = {
  home: routes.home,
  search: routes.search,
  wishlist: routes.buyer.wishlist,
  inbox: routes.buyer.inbox,
  account: routes.buyer.account,
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
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState("");

  const isDark = resolvedTheme === "dark";
  const activeId = activeIdFromPath(pathname);

  return (
    <>
      <AppTopbar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={(v) =>
          router.push(v ? `${routes.search}?q=${encodeURIComponent(v)}` : routes.search)
        }
        isDark={isDark}
        onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
        onLogoClick={() => router.push(routes.home)}
        onNotifClick={() => router.push(routes.buyer.notifications)}
        onAvatarClick={() => router.push(routes.buyer.account)}
      />
      <MobileBottomNav
        activeId={activeId}
        onSelect={(id) => {
          const to = NAV_ROUTES[id];
          if (to) router.push(to);
        }}
      />
    </>
  );
}
