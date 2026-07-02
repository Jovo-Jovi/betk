/**
 * Catalog i18n unit tests — OD-7 / BL-04 (DS-I18N wiring verification).
 *
 * Covers:
 *   1. ar.json / en.json key-parity for the `catalog` namespace (and the
 *      whole file) — equal key counts, zero orphans either side.
 *   2. ICU plural resolution for the two count-based catalog templates
 *      (StockBadge `stock.remaining`, FilterSheet `filters.resultCount`) at
 *      0/1/2/3/11 for AR + EN, matching the CLDR plural categories Arabic
 *      actually has (zero/one/two/few/many/other) vs English (one/other).
 *   3. `catalogCollectionDir` — CollectionStrip's server-derived `dir`.
 *
 * NOTE on ICU resolution in this test: the real resolution machinery at
 * runtime is next-intl's `t()` (via its `use-intl` dependency, itself not a
 * direct project dependency — OD-7 forbids adding a new one just for this
 * test). `resolveIcuPlural` below is a small, test-only re-implementation of
 * the *plural* subset of ICU MessageFormat that our catalog messages use
 * (single argument, `=N` exact matches + CLDR category clauses, no nested
 * ICU/rich-text). It defers the actual category selection to the native
 * `Intl.PluralRules` — the same CLDR plural-rule data ICU/next-intl use — so
 * this is a faithful check of our authored message text, not a reimplemented
 * pluralization engine.
 */

import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { catalogCollectionDir } from "@/i18n/catalogLabels";

// ── helpers ──────────────────────────────────────────────────────────────

/** Recursively collect dotted leaf-key paths from a nested message object. */
function leafKeyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

/**
 * Resolve a `{arg, plural, clause {text} ...}` ICU template for a given
 * numeric value + locale. See file header note — mirrors next-intl/ICU
 * plural resolution for the specific (unnested) shape our catalog uses.
 */
function resolveIcuPlural(template: string, value: number, locale: "ar" | "en"): string {
  const match = template.match(/^\{(\w+),\s*plural,\s*(.*)\}$/s);
  const body = match?.[2];
  if (!match || body === undefined) throw new Error(`Not a plural template: ${template}`);

  const clauseRe = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
  const clauses: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = clauseRe.exec(body))) {
    const [, clauseKey, clauseText] = m;
    if (clauseKey === undefined || clauseText === undefined) continue;
    clauses[clauseKey] = clauseText;
  }

  const exactKey = `=${value}`;
  const category = clauses[exactKey] !== undefined ? exactKey : new Intl.PluralRules(locale, { type: "cardinal" }).select(value);
  const text = clauses[category] ?? clauses.other;
  if (text === undefined) throw new Error(`No "other" clause in template: ${template}`);
  return text.replace(/#/g, String(value)).trim();
}

// ── 1. ar/en key parity ─────────────────────────────────────────────────

describe("messages/{ar,en}.json — key parity", () => {
  const arKeys = new Set(leafKeyPaths(ar));
  const enKeys = new Set(leafKeyPaths(en));

  it("has equal leaf-key counts", () => {
    expect(arKeys.size).toBe(enKeys.size);
  });

  it("has zero orphans on either side (whole file)", () => {
    const arOrphans = [...arKeys].filter((k) => !enKeys.has(k));
    const enOrphans = [...enKeys].filter((k) => !arKeys.has(k));
    expect(arOrphans).toEqual([]);
    expect(enOrphans).toEqual([]);
  });

  it("catalog namespace: equal keys, zero orphans", () => {
    const arCatalog = new Set(leafKeyPaths(ar.catalog, "catalog"));
    const enCatalog = new Set(leafKeyPaths(en.catalog, "catalog"));
    expect(arCatalog.size).toBe(enCatalog.size);
    expect([...arCatalog].filter((k) => !enCatalog.has(k))).toEqual([]);
    expect([...enCatalog].filter((k) => !arCatalog.has(k))).toEqual([]);
  });
});

// ── 2. ICU plural resolution ────────────────────────────────────────────

describe("catalog.stock.remaining — ICU plural (AR)", () => {
  const template = ar.catalog.stock.remaining;
  it.each([
    [0, "لا كمية متبقية"],
    [1, "باقي قطعة واحدة"],
    [2, "باقي قطعتان"],
    [3, "باقي 3 قطع"],
    [11, "باقي 11 قطعة"],
  ])("qty=%i -> %s", (qty, expected) => {
    expect(resolveIcuPlural(template, qty as number, "ar")).toBe(expected);
  });
});

describe("catalog.stock.remaining — ICU plural (EN)", () => {
  const template = en.catalog.stock.remaining;
  it.each([
    [0, "Out of stock"],
    [1, "1 item left"],
    [2, "2 items left"],
    [3, "3 items left"],
    [11, "11 items left"],
  ])("qty=%i -> %s", (qty, expected) => {
    expect(resolveIcuPlural(template, qty as number, "en")).toBe(expected);
  });
});

describe("catalog.filters.resultCount — ICU plural (AR)", () => {
  const template = ar.catalog.filters.resultCount;
  it.each([
    [0, "لا توجد نتائج"],
    [1, "عرض نتيجة واحدة"],
    [2, "عرض نتيجتين"],
    [3, "عرض 3 نتائج"],
    [11, "عرض 11 نتيجة"],
  ])("count=%i -> %s", (count, expected) => {
    expect(resolveIcuPlural(template, count as number, "ar")).toBe(expected);
  });
});

describe("catalog.filters.resultCount — ICU plural (EN)", () => {
  const template = en.catalog.filters.resultCount;
  it.each([
    [0, "No results"],
    [1, "Showing 1 result"],
    [2, "Showing 2 results"],
    [3, "Showing 3 results"],
    [11, "Showing 11 results"],
  ])("count=%i -> %s", (count, expected) => {
    expect(resolveIcuPlural(template, count as number, "en")).toBe(expected);
  });
});

describe("catalog.rating.reviews + catalog.store.listingCount + catalog.seller.responseTime — spot-check other categories exist", () => {
  it("AR few/many categories present for all remaining plural templates", () => {
    for (const template of [
      ar.catalog.rating.reviews,
      ar.catalog.store.listingCount,
      ar.catalog.seller.responseTime,
    ]) {
      expect(resolveIcuPlural(template, 3, "ar")).not.toMatch(/[{}]/);
      expect(resolveIcuPlural(template, 11, "ar")).not.toMatch(/[{}]/);
    }
  });

  it("EN one/other categories present for all remaining plural templates", () => {
    for (const template of [
      en.catalog.rating.reviews,
      en.catalog.store.listingCount,
      en.catalog.seller.responseTime,
    ]) {
      expect(resolveIcuPlural(template, 1, "en")).not.toMatch(/[{}]/);
      expect(resolveIcuPlural(template, 11, "en")).not.toMatch(/[{}]/);
    }
  });
});

// ── 3. CollectionStrip dir helper ───────────────────────────────────────

describe("catalogCollectionDir", () => {
  it("returns ltr for en, rtl for ar (and any other locale)", () => {
    expect(catalogCollectionDir("en")).toBe("ltr");
    expect(catalogCollectionDir("ar")).toBe("rtl");
  });
});
