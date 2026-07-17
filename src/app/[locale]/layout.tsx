import type { Metadata } from "next";
import { Cairo, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "../globals.css";

import { routing } from "@/i18n/routing";
import { ThemeProvider } from "../_providers/ThemeProvider";
import { SentryProvider } from "../_providers/SentryProvider";
import { PostHogProvider } from "../_providers/PostHogProvider";
import { Toaster } from "@/components/shared/Toaster";

/**
 * Display font — headings, store names, prices, hero.
 * Cairo: broad Arabic coverage + Latin companion.
 */
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

/**
 * Body font — body copy, forms, labels.
 * IBM Plex Sans Arabic: clean Arabic at small sizes.
 */
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});

/**
 * Mono font — BETK refs, tracking numbers, OTP digits.
 */
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BETK",
  description: "Arabic-first marketplace",
};

/** Pre-render both locales at build time (AR + EN). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Locale root layout — Server Component (OD-7).
 *
 * This is the app's ONLY <html>/<body> (there is no src/app/layout.tsx). The
 * document direction + language derive from the validated [locale] segment:
 *   - ar → dir="rtl" lang="ar"  (default, unprefixed URLs)
 *   - en → dir="ltr" lang="en"  (served under /en)
 *
 * Provider hierarchy:
 *   ThemeProvider          — light/dark class strategy (next-themes)
 *   NextIntlClientProvider — forwards messages/locale to client components
 *   SentryProvider         — client error monitoring (no PII)
 *   PostHogProvider        — client product analytics (no PII; user.id only)
 *   Toaster                — shadcn/sonner toast host
 *
 * `suppressHydrationWarning` on <html> is required so next-themes can set the
 * theme class before hydration without a mismatch warning.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate the locale at the edge of rendering — anything outside {ar, en}
  // is a 404 (OD-7: locale validated ∈ {ar, en} else notFound()).
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this request tree.
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${cairo.variable} ${ibmPlexSansArabic.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <ThemeProvider>
          <NextIntlClientProvider>
            <SentryProvider>
              <PostHogProvider>
                {children}
                <Toaster />
              </PostHogProvider>
            </SentryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
