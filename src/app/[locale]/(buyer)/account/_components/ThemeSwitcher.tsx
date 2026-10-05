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
 * REG-59 compose (decision 2026-10-05).
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEME_OPTIONS = ["light", "dark", "system"] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

export function ThemeSwitcher() {
  const t = useTranslations("account.settings");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleChange(next: string) {
    setTheme(next as ThemeOption);
  }

  return (
    <div data-slot="field" className="flex flex-col gap-1.5">
      <label htmlFor="theme-switcher" className="text-sm font-medium text-foreground">
        {t("themeLabel")}
      </label>
      <Select
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={handleChange}
        disabled={!mounted}
      >
        <SelectTrigger id="theme-switcher">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEME_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`themeOptions.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
