/**
 * BETK i18n routing configuration — OD-7 (bilingual AR/EN).
 *
 * Single source of truth for the locale set, the default locale, and the
 * URL-prefix strategy. Consumed by:
 *   - src/i18n/request.ts    (per-request message loading)
 *   - src/i18n/navigation.ts (locale-aware Link / redirect / router)
 *   - src/middleware.ts      (locale negotiation composed with the auth gates)
 *   - src/app/[locale]/layout.tsx (generateStaticParams + locale validation)
 *
 * Strategy (OD-7 §3):
 *   - locales: ['ar','en']; defaultLocale: 'ar'.
 *   - localePrefix: 'as-needed' → Arabic is unprefixed (existing URLs/SEO
 *     preserved), English lives under /en. e.g. `/` + `/foo` serve AR;
 *     `/en` + `/en/foo` serve EN.
 *   - Locale is validated at the edge / in the layout (∈ {ar, en} else 404).
 *
 * NO new content columns, NO translation service — presentation layer only.
 */

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic (default) omits the prefix; English is served under `/en`.
  localePrefix: "as-needed",
  // Deterministic default: an unprefixed path ALWAYS serves Arabic (existing
  // URLs/SEO preserved). We do NOT auto-redirect based on the Accept-Language
  // header or cookie — English is reached explicitly via `/en` or the Account →
  // Settings switcher (BL-03). This guarantees "/ and /foo serve AR".
  localeDetection: false,
});

/** Union of supported locales — `'ar' | 'en'`. */
export type AppLocale = (typeof routing.locales)[number];
