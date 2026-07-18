"use client";

/**
 * SearchView — the interactive /search surface. Phase 03 / T03 (compose-only).
 *
 * The RSC page (search/page.tsx) runs the query server-side and hands this
 * component the parsed params + the result page. Everything the user changes
 * (query, filters, sort, page) is written back into the URL via the
 * locale-aware router (`@/i18n/navigation`) so results are always shareable and
 * the back button works — the URL is the single source of truth. A fresh
 * `key` on each navigation (set by the page) re-seeds the local filter draft.
 *
 * Locale-neutral param names (same shape under /en): q, category, type,
 * governorate, city, price_min, price_max, sort, page.
 *
 * Compose-only: SearchBar / FilterSheet / FilterChips / ListingCard (via
 * ListingCardLink) are untouched Claude-Design components; ui/Sheet, ui/Select,
 * ui/Button are the shadcn base. No restyle.
 */

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { GOVERNORATES } from "@/constants/governorates";
import {
  catalogFilterSheetLabels,
  catalogFilterChipsLabels,
  catalogListingBoostLabel,
  catalogSearchBarLabels,
} from "@/i18n/catalogLabels";
import type { SearchListingItem, SearchListingType, SearchSort } from "@/features/discovery";
import { SearchBar, FilterSheet, FilterChips, EmptyState } from "@/components/shared";
import type { FilterValue, FilterChip } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ListingCardLink } from "./ListingCardLink";
import { StripErrorCard } from "./StripErrorCard";

export interface SearchViewProps {
  q: string;
  category?: string;
  type?: SearchListingType;
  governorate?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  sort: SearchSort;
  page: number;
  items: SearchListingItem[];
  total: number;
  hasMore: boolean;
  isError: boolean;
  /** Top-level categories for the filter pills (localized name). */
  categories: { id: string; name: string }[];
}

interface FullState {
  q?: string;
  category?: string;
  type?: SearchListingType;
  governorate?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  sort: SearchSort;
  page: number;
}

const SORT_OPTIONS: SearchSort[] = ["relevance", "newest", "price", "popularity"];

/** URL sort ↔ FilterSheet's own sort union. */
function toFilterSort(s: SearchSort): NonNullable<FilterValue["sort"]> {
  if (s === "price") return "price_asc";
  if (s === "popularity") return "popular";
  return s;
}
function fromFilterSort(s: FilterValue["sort"]): SearchSort {
  if (s === "price_asc") return "price";
  if (s === "popular") return "popularity";
  return (s ?? "relevance") as SearchSort;
}

function parseNum(v: number | string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function SearchView({
  q,
  category,
  type,
  governorate,
  city,
  priceMin,
  priceMax,
  sort,
  page,
  items,
  total,
  hasMore,
  isError,
  categories,
}: SearchViewProps) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const catalogT = useTranslations("catalog");

  const boostLabel = catalogListingBoostLabel(catalogT);
  const searchBarLabels = catalogSearchBarLabels(catalogT);
  const filterSheetLabels = catalogFilterSheetLabels(catalogT, total);
  const filterChipsLabels = catalogFilterChipsLabels(catalogT);

  const current: FullState = { q, category, type, governorate, city, priceMin, priceMax, sort, page };

  const [queryInput, setQueryInput] = useState(q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValue>(() => ({
    category: category ?? null,
    type: type ?? "all",
    governorate: governorate ?? null,
    priceMin: priceMin ?? "",
    priceMax: priceMax ?? "",
    sort: toFilterSort(sort),
  }));

  function navigate(patch: Partial<FullState>) {
    const next: FullState = { ...current, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.category) sp.set("category", next.category);
    if (next.type) sp.set("type", next.type);
    if (next.governorate) sp.set("governorate", next.governorate);
    if (next.city) sp.set("city", next.city);
    if (next.priceMin != null) sp.set("price_min", String(next.priceMin));
    if (next.priceMax != null) sp.set("price_max", String(next.priceMax));
    if (next.sort && next.sort !== "relevance") sp.set("sort", next.sort);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const qs = sp.toString();
    router.push(qs ? `${routes.search}?${qs}` : routes.search);
  }

  function applyDraft() {
    setSheetOpen(false);
    navigate({
      category: draft.category ?? undefined,
      type: draft.type && draft.type !== "all" ? draft.type : undefined,
      governorate: draft.governorate ?? undefined,
      priceMin: parseNum(draft.priceMin),
      priceMax: parseNum(draft.priceMax),
      sort: fromFilterSort(draft.sort),
      page: 1,
    });
  }

  function clearAllFilters() {
    setSheetOpen(false);
    navigate({
      category: undefined,
      type: undefined,
      governorate: undefined,
      city: undefined,
      priceMin: undefined,
      priceMax: undefined,
      page: 1,
    });
  }

  const hasActiveFilters =
    !!category || !!type || !!governorate || !!city || priceMin != null || priceMax != null;

  // ── Active-filter chips (removable) ──────────────────────────────────────
  const chips: FilterChip[] = [];
  if (category) {
    const name = categories.find((c) => c.id === category)?.name;
    if (name) chips.push({ id: "category", label: name });
  }
  if (type) chips.push({ id: "type", label: catalogT(`filters.types.${type}`) });
  if (governorate) {
    const g = GOVERNORATES.find((x) => x.value === governorate);
    if (g) chips.push({ id: "governorate", label: locale === "en" ? g.labelEn : g.labelAr });
  }
  if (city) chips.push({ id: "city", label: city });
  if (priceMin != null || priceMax != null) {
    const cur = catalogT("price.currency");
    const label =
      priceMin != null && priceMax != null
        ? `${priceMin} – ${priceMax} ${cur}`
        : priceMin != null
          ? `≥ ${priceMin} ${cur}`
          : `≤ ${priceMax} ${cur}`;
    chips.push({ id: "price", label });
  }

  function removeChip(id: string) {
    if (id === "price") navigate({ priceMin: undefined, priceMax: undefined, page: 1 });
    else navigate({ [id]: undefined, page: 1 } as Partial<FullState>);
  }

  const govOptions = GOVERNORATES.map((g) => ({
    value: g.value,
    labelAr: locale === "en" ? g.labelEn : g.labelAr,
  }));

  const heading = q ? t("resultsFor", { query: q }) : t("allResults");
  const hasBoostedOnPage = page === 1 && items.some((i) => i.isBoosted);

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-5 px-4 py-6">
      <div className="w-full max-w-[640px]">
        <SearchBar
          value={queryInput}
          onChange={setQueryInput}
          onSubmit={(v) => navigate({ q: v.trim() || undefined, page: 1 })}
          placeholder={searchBarLabels.placeholder}
          clearLabel={searchBarLabels.clearLabel}
          size="lg"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-h2 font-bold text-foreground">{heading}</h1>
          <p className="text-sm text-muted-foreground">{filterSheetLabels.resultCount}</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => navigate({ sort: v as SearchSort, page: 1 })}>
            <SelectTrigger className="h-10 w-auto min-w-[9rem] gap-2" aria-label={t("sortLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {filterSheetLabels.sorts[toFilterSort(s)]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mobile: filters open in a Sheet; desktop uses the inline panel. */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 md:hidden">
                <SlidersHorizontal className="size-4" />
                {t("filtersButton")}
              </Button>
            </SheetTrigger>
            <SheetContent
              side={locale === "en" ? "left" : "right"}
              className="w-[88%] max-w-sm overflow-y-auto p-0"
            >
              <SheetTitle className="sr-only">{filterSheetLabels.title}</SheetTitle>
              <FilterSheet
                asSheet
                value={draft}
                onChange={setDraft}
                onApply={applyDraft}
                onClear={clearAllFilters}
                categories={categories.map((c) => ({ id: c.id, nameAr: c.name }))}
                governorates={govOptions}
                resultCount={total}
                labels={filterSheetLabels}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {chips.length > 0 && (
        <FilterChips
          chips={chips}
          onRemove={removeChip}
          onClearAll={clearAllFilters}
          clearAllLabel={filterChipsLabels.clearAllLabel}
          removeLabel={filterChipsLabels.removeLabel}
        />
      )}

      <div className="flex items-start gap-6">
        <aside className="hidden shrink-0 md:block">
          <FilterSheet
            value={draft}
            onChange={setDraft}
            onApply={applyDraft}
            onClear={clearAllFilters}
            categories={categories.map((c) => ({ id: c.id, nameAr: c.name }))}
            governorates={govOptions}
            resultCount={total}
            labels={filterSheetLabels}
          />
        </aside>

        <div className="min-w-0 flex-1">
          {isError ? (
            <StripErrorCard message={t("error")} retryLabel={tCommon("retry")} />
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                variant="filtered"
                message={q ? t("emptyWithQuery", { query: q }) : t("emptyGeneric")}
                hint={t("emptyHint")}
                action={hasActiveFilters ? { label: t("clearFilters"), onClick: clearAllFilters } : undefined}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hasBoostedOnPage && (
                <p className="text-sm font-semibold text-muted-foreground">{t("featuredResults")}</p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {items.map((item) => (
                  <ListingCardLink
                    key={item.id}
                    id={item.id}
                    title={localizedName({ ar: item.titleAr, en: item.titleEn }, locale)}
                    image={item.heroImageUrl}
                    price={item.price}
                    priceType={item.priceType}
                    storeName={
                      item.store
                        ? localizedName({ ar: item.store.nameAr, en: item.store.nameEn }, locale)
                        : null
                    }
                    rating={item.store?.rating?.averageRating ?? null}
                    reviews={item.store?.rating?.totalReviews ?? null}
                    boosted={item.isBoosted}
                    boostLabel={boostLabel}
                    stockQty={item.stockQty}
                    isMadeToOrder={item.isMadeToOrder}
                    isService={item.type === "service"}
                  />
                ))}
              </div>

              {(page > 1 || hasMore) && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => navigate({ page: page - 1 })}
                  >
                    {t("prev")}
                  </Button>
                  <span className="text-sm text-muted-foreground">{t("pageLabel", { page })}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => navigate({ page: page + 1 })}
                  >
                    {t("next")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
