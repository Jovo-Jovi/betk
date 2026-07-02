"use client";

/**
 * LanguageSwitcher — Account → Settings AR↔EN language switch (OD-7 / BL-03).
 *
 * Navigates to the SAME page in the other locale via next-intl's locale-aware
 * router (`@/i18n/navigation`), which adds/removes the `/en` prefix for the
 * CURRENT pathname and lets the next-intl middleware (BL-01) set the
 * `NEXT_LOCALE` cookie on the resulting request. No full page — this stays on
 * `/account`, just under the other locale.
 *
 * Persistence: URL (locale segment) + cookie, per OD-7 — no DB column.
 *
 * Phase 02 / OD-7 BL-03.
 * TODO(Phase DS): restyle with Claude Design system components.
 */

import type { ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("account.settings");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as AppLocale;
    if (nextLocale === locale) return;
    // Same canonical pathname, other locale — router.replace avoids growing
    // browser history with a duplicate entry per language toggle.
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div data-slot="field">
      <label htmlFor="language-switcher">{t("languageLabel")}</label>
      <select
        id="language-switcher"
        name="language"
        value={locale}
        onChange={handleChange}
      >
        <option value="ar">{t("languageOptions.ar")}</option>
        <option value="en">{t("languageOptions.en")}</option>
      </select>
    </div>
  );
}
