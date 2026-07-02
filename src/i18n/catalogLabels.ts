/**
 * catalogLabels — next-intl wiring for the shared catalog kit (OD-7 / BL-04).
 *
 * DS-I18N (Claude Design) de-hardcoded the Arabic literals baked into the 16
 * shared catalog components (`src/components/shared/*`) into additive string
 * props with Arabic defaults (see the handoff README, now deleted — history
 * in git). This module is the ONE place that turns the `messages/{ar,en}.json`
 * `catalog.*` namespace into the exact prop shapes those components expect,
 * so every future consuming page wires them the same way instead of
 * re-deriving the mapping ad hoc.
 *
 * Two resolution styles, matching how each component consumes its prop:
 *   1. Plain / enum-map strings (StatusBadge.labels, StockBadge.labels,
 *      LevelBadge.labels, PriceBlock.*, FilterSheet chrome, …) — resolved
 *      directly via `t()`/`t.raw()`; no runtime value needed.
 *   2. Count/qty/hours templates whose component ALSO does its own
 *      `.replace("{token}", value)` (StockBadge.remainingLabel,
 *      FilterSheet.resultCount, RatingSummary.reviewsLabel,
 *      StoreCard.listingCountLabel, SellerMiniCard.responseLabel) — these
 *      message values are ICU plural rules (AR: zero/one/two/few/many/other),
 *      so they MUST be fully resolved here via `t(key, { value })` into a
 *      plain finished string (never `t.raw`, which would hand the component
 *      raw `{n, plural, ...}` syntax that its naive string-replace would
 *      mangle). The component's own `.replace()` then becomes a harmless
 *      no-op since the finished string has no literal placeholder left.
 *   3. One true exception — FilterChips.removeLabel: the SAME prop is
 *      applied by the component to a different chip label on every item in
 *      an array, so it cannot be pre-resolved to one finished string. Its
 *      catalog message is plain interpolation syntax (not ICU plural), so
 *      `t.raw()` safely returns the literal "{label}" template for the
 *      component to substitute itself, per chip.
 *
 * Callers pass the `catalog`-scoped translator, e.g.:
 *   const t = await getTranslations("catalog");        // RSC
 *   const t = useTranslations("catalog");               // Client Component
 *   <StatusBadge domain="order" status={row.status} labels={catalogStatusLabels(t)} />
 */

import type { StatusDomain } from "@/constants/statusColors";
import type { SellerLevel } from "@/constants/enums";
import type { FilterSheetLabels } from "@/components/shared/FilterSheet";

/**
 * Minimal structural shape of the next-intl translator this module needs —
 * avoids importing next-intl's message-schema-parameterized generic types.
 * The real `useTranslations`/`getTranslations` return value satisfies this.
 */
export interface CatalogTranslator {
  (key: string, values?: Record<string, string | number>): string;
  raw(key: string): unknown;
}

/** Mirrors StockBadge's private `StockState` union (not exported by the component). */
export type StockState = "in_stock" | "low" | "sold_out" | "made_to_order" | "service";

/**
 * StatusBadge — domain→status→label map, for the `labels` prop.
 *
 * Covers the 7 domains catalogued under `catalog.status.*`
 * (order/seller/payment/listing/dispute/boost/payout). `flag` (moderation
 * flags) is intentionally absent — it has colors in constants/statusColors.ts
 * but no Arabic default labels yet (pending a Design decision, BL-04-FIX);
 * `StatusBadgeProps.labels` is `Partial<...>` precisely so callers don't have
 * to supply it. Required before any flag/moderation badge renders (admin phase).
 */
export function catalogStatusLabels(
  t: CatalogTranslator,
): Partial<Record<StatusDomain, Record<string, string>>> {
  return t.raw("status") as Partial<Record<StatusDomain, Record<string, string>>>;
}

/** StockBadge — state→label map (pass as the `labels` prop). */
export function catalogStockLabels(t: CatalogTranslator): Record<StockState, string> {
  return t.raw("stock.labels") as Record<StockState, string>;
}

/**
 * StockBadge — finished "remaining" string for the low-stock state.
 * `qty` is the same value passed as the component's `stockQty` prop.
 */
export function catalogStockRemainingLabel(t: CatalogTranslator, qty: number): string {
  return t("stock.remaining", { qty });
}

/** LevelBadge — tier→label map. */
export function catalogLevelLabels(t: CatalogTranslator): Record<SellerLevel, string> {
  return t.raw("level") as Record<SellerLevel, string>;
}

/** PriceBlock — the four currency/qualifier props. */
export function catalogPriceLabels(t: CatalogTranslator): {
  currency: string;
  startingFromLabel: string;
  perHourLabel: string;
  quoteLabel: string;
} {
  return {
    currency: t("price.currency"),
    startingFromLabel: t("price.startingFrom"),
    perHourLabel: t("price.perHour"),
    quoteLabel: t("price.quote"),
  };
}

/**
 * FilterSheet — the full `labels` object. `resultCount`, if given, is
 * resolved to a finished ICU-plural string (same count as the component's
 * own `resultCount` prop); otherwise the unused raw template is returned
 * (harmless — FilterSheet only reads it when `resultCount` is a number).
 */
export function catalogFilterSheetLabels(
  t: CatalogTranslator,
  resultCount?: number,
): FilterSheetLabels {
  const raw = t.raw("filters") as FilterSheetLabels;
  return {
    ...raw,
    resultCount: typeof resultCount === "number" ? t("filters.resultCount", { count: resultCount }) : raw.resultCount,
  };
}

/** FilterChips — clearAllLabel resolved; removeLabel stays a raw per-chip template. */
export function catalogFilterChipsLabels(t: CatalogTranslator): {
  clearAllLabel: string;
  removeLabel: string;
} {
  return {
    clearAllLabel: t("filters.clearAll"),
    removeLabel: t.raw("filters.remove") as string,
  };
}

/** CollectionStrip — "see all" label. */
export function catalogCollectionSeeAllLabel(t: CatalogTranslator): string {
  return t("collection.seeAll");
}

/**
 * CollectionStrip — `dir` prop derived from the request locale (server-side),
 * per DS-I18N's LTR chevron fix. NEVER read `document.dir` on the client.
 */
export function catalogCollectionDir(locale: string): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}

/** RatingSummary — finished "N reviews" string for the given total. */
export function catalogRatingReviewsLabel(t: CatalogTranslator, count: number): string {
  return t("rating.reviews", { count });
}

/** VerifiedBadge — label/tooltip text. */
export function catalogVerifiedLabel(t: CatalogTranslator): string {
  return t("verified.label");
}

/** WishlistButton — both aria-label states. */
export function catalogWishlistLabels(t: CatalogTranslator): {
  addLabel: string;
  removeLabel: string;
} {
  return { addLabel: t("wishlist.add"), removeLabel: t("wishlist.remove") };
}

/** SearchBar — placeholder + clear aria-label. */
export function catalogSearchBarLabels(t: CatalogTranslator): {
  placeholder: string;
  clearLabel: string;
} {
  return { placeholder: t("search.placeholder"), clearLabel: t("search.clear") };
}

/** FollowButton — both state labels. */
export function catalogFollowButtonLabels(t: CatalogTranslator): {
  followLabel: string;
  followingLabel: string;
} {
  return { followLabel: t("follow.follow"), followingLabel: t("follow.following") };
}

/** ListingCard — boost ribbon label. */
export function catalogListingBoostLabel(t: CatalogTranslator): string {
  return t("listing.boost");
}

/** StoreCard — finished "N listings" string for the given count. */
export function catalogStoreListingCountLabel(t: CatalogTranslator, count: number): string {
  return t("store.listingCount", { count });
}

/** SellerMiniCard — finished "responds within N hours" string. */
export function catalogSellerResponseLabel(t: CatalogTranslator, hours: number): string {
  return t("seller.responseTime", { hours });
}
