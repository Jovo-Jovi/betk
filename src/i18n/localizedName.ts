/**
 * localizedName — name/title bilingual fallback for the read layer (OD-7).
 *
 * SCOPE — NAMES AND TITLES ONLY. Use this for the short, structured bilingual
 * fields that exist as paired `*_ar` / `*_en` columns:
 *   - listing titles      (listings.title_ar / title_en)
 *   - store / collection names (stores.name_ar / name_en, collections.name_ar / name_en)
 *   - category names      (categories.name_ar / name_en)
 *
 * Behavior = COALESCE(locale column, other column) → NEVER blank (OD-7 model):
 *   - locale 'en' → en ?? ar
 *   - locale 'ar' → ar ?? en
 * (`title_en` is nullable in the DB — no migration — so the fallback is a real
 * safety net for goods whose English title hasn't been entered yet.)
 *
 * ⚠️ DO NOT use this for descriptions or bios. Per OD-7 those are a SINGLE field
 * in the author's language, shown as-authored to everyone — no translation, no
 * fallback logic. Render `description` / `bio` directly.
 */

import type { AppLocale } from "./routing";

/** A pair of bilingual name/title values (either may be null/absent). */
export interface BilingualName {
  ar?: string | null;
  en?: string | null;
}

/**
 * Resolve the display name/title for a locale, falling back to the other locale
 * so the result is never blank. Returns "" only if BOTH values are absent.
 */
export function localizedName(value: BilingualName, locale: AppLocale): string {
  const primary = locale === "en" ? value.en : value.ar;
  const fallback = locale === "en" ? value.ar : value.en;
  return (primary ?? fallback ?? "").trim();
}

/**
 * Convenience for reading directly off a DB-style row using a shared base key.
 * e.g. `localizedNameFromRow(listing, "title", locale)` reads `title_ar` /
 * `title_en`. Keeps call sites terse in the discovery read layer.
 */
export function localizedNameFromRow<K extends string>(
  row: Partial<Record<`${K}_ar` | `${K}_en`, string | null>>,
  base: K,
  locale: AppLocale,
): string {
  return localizedName(
    { ar: row[`${base}_ar`], en: row[`${base}_en`] },
    locale,
  );
}
