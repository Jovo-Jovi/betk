"use client";

/**
 * ThemeSwitcher — Account → Settings light/dark/system theme switch (OD-7 / BL-03).
 *
 * Thin composition over `next-themes`' `useTheme()` — the provider (class
 * strategy on <html>, BL-01) already handles the actual light/dark toggling
 * and its own localStorage persistence; this control just calls `setTheme`.
 *
 * `mounted` guard: `theme` is unknown on the server (next-themes resolves it
 * client-side from localStorage/system), so this control renders a fixed
 * "system" value until mount rather than reading `theme` before hydration —
 * avoids a hydration-mismatch warning on THIS control. The page-wide
 * no-flash guarantee (right theme painted before first paint) is next-themes'
 * injected script + `suppressHydrationWarning` on <html>, already in place
 * since BL-01 — unrelated to this component's own hydration safety.
 *
 * Persistence: next-themes' localStorage — no DB column (OD-7).
 *
 * Phase 02 / OD-7 BL-03.
 * TODO(Phase DS): restyle with Claude Design system components.
 */

import { useEffect, useState, type ChangeEvent } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

const THEME_OPTIONS = ["light", "dark", "system"] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

export function ThemeSwitcher() {
  const t = useTranslations("account.settings");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setTheme(event.target.value as ThemeOption);
  }

  return (
    <div data-slot="field">
      <label htmlFor="theme-switcher">{t("themeLabel")}</label>
      <select
        id="theme-switcher"
        name="theme"
        value={mounted ? (theme ?? "system") : "system"}
        onChange={handleChange}
        disabled={!mounted}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`themeOptions.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
