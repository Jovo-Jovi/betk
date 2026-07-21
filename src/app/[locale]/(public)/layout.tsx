import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppChrome } from "../_components/AppChrome";
import { Footer } from "@/components/shared";
import type { FooterColumn } from "@/components/shared";
import { routes, withLocale } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";

/**
 * PublicShell — layout wrapper for all (public) routes.
 *
 * DS-LAND: the T09 topbar placeholder is replaced by the DS shell chrome
 * (AppTopbar + MobileBottomNav) via <AppChrome />. The bottom nav is fixed and
 * md:hidden, so the shell gets bottom padding on mobile only.
 *
 * CD-DELTA-1: mounts <Footer /> below the content slot (public shell only —
 * no seller/admin wiring). Labels come from the `footer` next-intl namespace;
 * hrefs use `routes.*` + `withLocale()` where a frozen-scope page exists
 * (seller onboarding/dashboard, home). "Categories"/"Stores"/"Help
 * center"/"Contact us" have no corresponding page in the frozen UI Spec
 * inventory (§6) — left without an href (Footer renders them as
 * non-navigating per its own contract) rather than inventing a page; flagged
 * for a future Design/product decision.
 *
 * PERF-02: this layout wraps ISR routes (`/category/[slug]`, `/listing/[id]`).
 * Next.js renders layouts and pages independently, so — per next-intl's
 * static-rendering contract — this layout must `setRequestLocale` on its OWN
 * scope; the root `[locale]/layout.tsx` call does NOT carry over during runtime
 * on-demand ISR generation. Without it, on the `/en/...` (non-default) on-demand
 * path this layout's `getLocale()`/`getTranslations` fall back to `headers()`
 * and abort generation with DYNAMIC_SERVER_USAGE (500) — the default locale is
 * silently masked by next-intl's fallback. We also read `locale` from the
 * validated `[locale]` segment param and pass it EXPLICITLY, so the render path
 * never depends on the store.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;
  const t = await getTranslations({ locale, namespace: "footer" });

  const columns: FooterColumn[] = [
    {
      title: t("columns.market.title"),
      links: [
        { label: t("columns.market.links.categories") },
        { label: t("columns.market.links.stores") },
        { label: t("columns.market.links.featured"), href: withLocale(routes.home, locale) },
      ],
    },
    {
      title: t("columns.sellers.title"),
      links: [
        { label: t("columns.sellers.links.openStore"), href: withLocale(routes.seller.onboarding, locale) },
        { label: t("columns.sellers.links.sellerConsole"), href: withLocale(routes.seller.dashboard, locale) },
      ],
    },
    {
      title: t("columns.help.title"),
      links: [
        { label: t("columns.help.links.helpCenter") },
        { label: t("columns.help.links.contact") },
      ],
    },
  ];

  return (
    <div
      data-slot="public-shell"
      className="flex min-h-screen flex-col pb-[var(--bottom-nav-height)] md:pb-0"
    >
      <AppChrome />

      <main data-slot="content" className="flex-1">
        {children}
      </main>

      <Footer
        logoSrc="/logo/beh-64.png"
        tagline={t("tagline")}
        columns={columns}
        copyright={t("copyright")}
      />
    </div>
  );
}
