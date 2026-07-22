"use client";

/**
 * SellerChrome — wires the frozen DS ConsoleSidebar (seller variant) into the
 * (seller) route-group shell (AppChrome pattern, sibling of the buyer/public
 * AppChrome). App-router-owned glue only: the sidebar itself is a frozen,
 * callback-driven DS component — this file supplies its navigation, labels,
 * active state, theme toggle, and mobile open/close behaviour.
 *
 * Navigation goes through the locale-aware `@/i18n/navigation` router (typed
 * routes under [locale]; NOT bare next/link) so the current locale is preserved.
 * `activeId` derives from the current (locale-stripped) pathname.
 *
 * Nav items are ONLY the seller routes that exist in the current phase's scope
 * from `@/constants/routes`: the Phase-04 set (dashboard-landing, application
 * status, store profile + delivery/returns/payments sub-settings) plus Phase-05
 * `listings` (T03, Listings Management, `/seller/listings`) and `inventory`
 * (T05, Stock & Inventory, `/seller/inventory` — the T03 deliberate deferral is
 * now CLOSED: the route exists as of this task, so the nav item lands with it,
 * no dead link), plus Phase-06 `inbox` (T04, Seller Inbox, `/seller/inbox` —
 * deferral CLOSED: the route exists as of this task). Later-phase console
 * routes (orders, earnings, analytics, …) light up when their phases land.
 *
 * CD-DELTA-4 (REG-38b): mounts the shared `RouteProgress` top bar (renders null
 * at rest) so the seller shell gets the same global route-transition feedback as
 * the public/buyer shell; a `useTransition` drives it for in-console navigation
 * and the locale toggle.
 *
 * Composition only — no restyle. Zero edits to components/ui or components/shared.
 */

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Inbox,
  ClipboardList,
  Store,
  Truck,
  RotateCcw,
  Wallet,
  Menu,
  Moon,
  Sun,
  Languages,
} from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { ConsoleSidebar, RouteProgress } from "@/components/shared";
import type { SidebarSection } from "@/components/shared";
import { routes } from "@/constants/routes";

/** Nav id → canonical (locale-neutral) route. Phase-04 + Phase-05 (T03+T05) scope. */
const NAV_ROUTES: Record<string, string> = {
  dashboard: routes.seller.dashboard,
  listings: routes.seller.listings,
  inventory: routes.seller.inventory,
  inbox: routes.seller.inbox,
  status: routes.seller.status,
  store: routes.seller.store,
  delivery: routes.seller.storeDelivery,
  returns: routes.seller.storeReturns,
  payments: routes.seller.storePayments,
};

/** Nav icons by id (label text is supplied by next-intl, below). */
const NAV_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="size-5" />,
  listings: <Package className="size-5" />,
  inventory: <Boxes className="size-5" />,
  inbox: <Inbox className="size-5" />,
  status: <ClipboardList className="size-5" />,
  store: <Store className="size-5" />,
  delivery: <Truck className="size-5" />,
  returns: <RotateCcw className="size-5" />,
  payments: <Wallet className="size-5" />,
};

/** Ordered nav ids — dashboard, listings, inventory, inbox, status, then the store settings cluster. */
const NAV_IDS = ["dashboard", "listings", "inventory", "inbox", "status", "store", "delivery", "returns", "payments"] as const;

/** Derive the active nav id from the locale-stripped pathname (longest match). */
function activeIdFromPath(pathname: string): string {
  if (pathname.startsWith(routes.seller.storeDelivery)) return "delivery";
  if (pathname.startsWith(routes.seller.storeReturns)) return "returns";
  if (pathname.startsWith(routes.seller.storePayments)) return "payments";
  if (pathname.startsWith(routes.seller.store)) return "store";
  if (pathname.startsWith(routes.seller.inventory)) return "inventory";
  if (pathname.startsWith(routes.seller.inbox)) return "inbox";
  if (pathname.startsWith(routes.seller.listings)) return "listings";
  if (pathname.startsWith(routes.seller.status)) return "status";
  if (pathname === routes.seller.dashboard) return "dashboard";
  return "";
}

export function SellerChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isRoutePending, startRouteTransition] = useTransition();

  const isDark = resolvedTheme === "dark";
  const activeId = activeIdFromPath(pathname);
  const otherLocale: AppLocale = locale === "ar" ? "en" : "ar";

  const sections: SidebarSection[] = [
    {
      items: NAV_IDS.map((id) => ({
        id,
        icon: NAV_ICONS[id],
        label: t(`nav.${id}`),
      })),
    },
  ];

  return (
    <>
      <RouteProgress active={isRoutePending} ariaLabel={tCommon("loading")} />
      {/* Mobile console header: hamburger opens the off-canvas sidebar (md:hidden). */}
      <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("openNav")}
          className="flex size-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-display text-base font-extrabold text-primary">BETK</span>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => startRouteTransition(() => router.replace(pathname, { locale: otherLocale }))}
            aria-label={t("language")}
            className="flex size-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Languages className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={t("theme")}
            className="flex size-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
        </div>
      </header>

      <ConsoleSidebar
        subtitle={t("subtitle")}
        sections={sections}
        activeId={activeId}
        onSelect={(id) => {
          const to = NAV_ROUTES[id];
          if (to) startRouteTransition(() => router.push(to));
          setOpen(false);
        }}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
