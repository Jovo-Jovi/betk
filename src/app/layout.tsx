import type { Metadata } from "next";
import { Cairo, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

import { SentryProvider } from "./_providers/SentryProvider";
import { PostHogProvider } from "./_providers/PostHogProvider";
import { Toaster } from "@/components/ui/sonner";

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

/**
 * Root layout — Server Component.
 * Sets RTL direction, loads fonts, mounts client providers as leaf components
 * so this file stays a pure RSC (no "use client" here).
 *
 * Provider hierarchy:
 *   SentryProvider  — client error monitoring (init once, no PII)
 *   PostHogProvider — client product analytics (no PII; user.id only)
 *   Toaster         — shadcn/sonner toast host
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      dir="rtl"
      lang="ar"
      className={`${cairo.variable} ${ibmPlexSansArabic.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <SentryProvider>
          <PostHogProvider>
            {children}
            <Toaster />
          </PostHogProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
