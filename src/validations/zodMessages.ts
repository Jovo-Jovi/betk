/**
 * translateZodIssue — safely resolve a Zod issue's `message` as a translation
 * key against the `validation` message namespace (OD-7 / BL-02).
 *
 * Schemas in this folder set `message`/`errorMap` to translation KEYS (e.g.
 * "phoneRequired"), not display strings — see the doc comments in
 * `@/validations/auth` and `@/validations/account`. Callers translate via:
 *
 *   const t = await getTranslations("validation");
 *   const msg = translateZodIssue(t, parsed.error.errors[0]?.message);
 *
 * A Zod issue can ALSO carry a Zod-GENERATED message (e.g. "Required",
 * "Expected string, received null") when a field is missing/mistyped before
 * any of our custom messages apply (e.g. `formData.get()` returned `null`).
 * `t.has()` distinguishes a real translation key from that case so a stray
 * Zod-internal string never crashes next-intl (MISSING_MESSAGE) or leaks
 * untranslated English wording to the user — it falls back to a generic,
 * translated message instead.
 */

import type { useTranslations } from "next-intl";

type ValidationTranslator = ReturnType<typeof useTranslations<"validation">>;

/** Generic fallback key — always present in the `validation` namespace. */
const FALLBACK_KEY = "invalidInput";

export function translateZodIssue(
  t: ValidationTranslator,
  key: string | undefined,
): string {
  if (key && t.has(key)) {
    return t(key);
  }
  return t(FALLBACK_KEY);
}
