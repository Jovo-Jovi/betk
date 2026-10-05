"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Languages, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { ConsoleSidebar, RouteProgress } from "@/components/shared";
import type { SidebarSection } from "@/components/shared";
import { routes } from "@/constants/routes";

/**
 * P49 shell. Composes the frozen ConsoleSidebar. One nav item, the queue
 * that exists in this phase. No restyle.
 */
export function ApprovalsChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("admin.approvals");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isRoutePending, startRouteTransition] = useTransition();
  const isDark = resolvedTheme === "dark";
  const otherLocale: AppLocale = locale === "ar" ? "en" : "ar";
  const activeId = pathname.startsWith(routes.admin.sellerApprovals) ? "approvals" : "";

  const sections: SidebarSection[] = [
    {
      items: [
        {
          id: "approvals",
          icon: <ClipboardList className="size-5" />,
          label: t("nav"),
        },
      ],
    },
  ];

  return (
    <>
      <RouteProgress active={isRoutePending} ariaLabel={tCommon("loading")} />
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
        subtitle={t("consoleSubtitle")}
        sections={sections}
        activeId={activeId}
        onSelect={() => {
          startRouteTransition(() => router.push(routes.admin.sellerApprovals));
          setOpen(false);
        }}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
