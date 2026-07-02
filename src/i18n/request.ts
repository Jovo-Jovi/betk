/**
 * Per-request next-intl configuration — OD-7.
 *
 * Resolves the active locale for the current request (validated against the
 * routing config) and loads the matching message catalog. Referenced by the
 * next-intl plugin in next.config.ts.
 *
 * Catalogs live at repo-root `messages/{ar,en}.json` (BETK-owned UI copy — no
 * translation service). Only shell/chrome strings live here; goods
 * titles/names come from existing `*_ar`/`*_en` columns, and descriptions/bios
 * render as-authored (see localizedName + OD-7 model).
 */

import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is typically the `[locale]` segment. Validate it and fall
  // back to the default locale for anything unexpected.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
