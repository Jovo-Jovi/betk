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
 * PERF-01 / REG-38: `router.replace` is a full server round-trip. While that
 * transition is pending the kit Select stays disabled + aria-busy, with the
 * same token-only opacity-60 / cursor-progress treatment.
 *
 * REG-59 compose (decision 2026-10-05).
 */

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const t = useTranslations("account.settings");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: string) {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale as AppLocale });
    });
  }

  return (
    <div data-slot="field" aria-busy={isPending} className="flex flex-col gap-1.5">
      <label htmlFor="language-switcher" className="text-sm font-medium text-foreground">
        {t("languageLabel")}
      </label>
      <Select value={locale} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger
          id="language-switcher"
          aria-busy={isPending}
          className={cn(isPending && "cursor-progress opacity-60")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ar">{t("languageOptions.ar")}</SelectItem>
          <SelectItem value="en">{t("languageOptions.en")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
