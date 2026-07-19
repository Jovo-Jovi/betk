import "./globals.css";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Global 404 (OD-7 / REG-28) — the localized not-found for the whole app.
 *
 * WHY THIS FILE: the app's real <html>/<body> live in `[locale]/layout.tsx`
 * (there is no `app/layout.tsx`). On Next.js 15.5, a `notFound()` raised inside
 * the `[locale]` segment renders the localized `[locale]/not-found.tsx` CONTENT
 * but cannot re-apply the dynamic `[locale]` layout's document shell — Next wraps
 * it in the bare `__next_error__` html (no `<html lang/dir>`, no NextIntl, generic
 * title). That is REG-28's drift. `global-not-found.js` (Next 15.4+) is the
 * framework-sanctioned fix for exactly this case: a route-level 404 that renders
 * its OWN full HTML document, so we regain `<html lang/dir>` + NextIntl context +
 * a localized EmptyState.
 *
 * SCOPE (verified on next@15.5): `global-not-found.js` fires for routes that
 * match NO segment at all — unknown paths + bad/unknown locale prefixes
 * (`/xx`, `/does-not-exist`, `/en/nope`, `/xx/admin`). An explicit `notFound()`
 * thrown from a MATCHED route (a listing/category/store detail whose record is
 * absent) is still resolved by the nearest `[locale]/not-found.tsx` boundary
 * (localized content, but wrapped in Next's default shell — the residual
 * framework limitation of vercel/next.js#64870, not a BETK regression).
 *
 * Locale: there is no `[locale]` segment param here (this renders above it), so
 * we read the negotiated locale from the `NEXT_LOCALE` cookie the middleware
 * sets, validated against the routing config (fallback = default locale `ar`).
 * Kit components only (EmptyState) — no new 404 design. Next marks not-found
 * responses `noindex` automatically; `metadata` re-asserts it explicitly.
 */
export const metadata = {
  title: "BETK",
  robots: { index: false, follow: false },
};

export default async function GlobalNotFound() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, cookieLocale)
    ? cookieLocale
    : routing.defaultLocale;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const t = await getTranslations({ locale, namespace: "notFound" });
  const messages = await getMessages({ locale });
  const homeHref = (locale === routing.defaultLocale
    ? "/"
    : `/${locale}`) as Route;

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
            <EmptyState
              variant="filtered"
              message={t("title")}
              hint={t("description")}
            />
            <Link
              href={homeHref}
              className="text-sm font-medium text-primary underline"
            >
              {t("backHome")}
            </Link>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
