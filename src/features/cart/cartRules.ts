/**
 * P66 rules, derived at read time. No new table, column, or write.
 *
 * R-BLOCKED uses the predicates in checkout_from_cart
 * (supabase/migrations/20261003082041_v2_08_functions.sql):
 * - Lines 792–809: a listing is resolvable only when deleted_at is null
 *   and status is active or sold_out.
 * - Lines 812–829: a custom line is quote-blocked when the inquiry is
 *   missing or quote_expires_at is null or <= now() (lines 820–825).
 * - Lines 846–855: tracked stock_qty < quantity, i.e. quantity > stock_qty.
 * sold_out and stock_qty === 0 are stock blocks with the out-of-stock
 * label. A store that is not active is not refused by checkout (REG-115;
 * lines 896–898 read governorate only). P66 still blocks that line as
 * stock with the unavailable label. Unavailable is first so that label
 * wins when the listing or the store is gone. Quote is checked before
 * the quantity-versus-stock check, matching the function's order.
 */

export type CartStockLabel = "out_of_stock" | "unavailable";

export interface CartBlockInput {
  isCustom: boolean;
  quantity: number;
  quoteExpiresAt: string | null;
  /** False when a custom line has no readable inquiry (checkout: q.id IS NULL). */
  inquiryPresent: boolean;
  /** Null when the listing embed is missing (the buyer cannot see it). */
  listing: {
    status: string;
    deletedAt: string | null;
    stockQty: number | null;
  } | null;
  /** Null when the store embed is missing. */
  storeStatus: string | null;
}

export interface CartBlock {
  blockedReason: "stock" | "quote_expired" | null;
  stockLabel: CartStockLabel | null;
}

export interface DroppedInquiry {
  inquiryId: string;
  quoteExpiresAt: string | null;
  status: string;
  hasCartLine: boolean;
  cancelledAts: readonly string[];
}

/** checkout_from_cart lines 824–825: NULL or <= now(). */
export function customQuoteExpired(quoteExpiresAt: string | null, now: Date): boolean {
  if (quoteExpiresAt == null) return true;
  const expires = Date.parse(quoteExpiresAt);
  return Number.isNaN(expires) || expires <= now.getTime();
}

/** A real timestamp on or before now. Null does not qualify. */
function quoteTimestampElapsed(quoteExpiresAt: string | null, now: Date): boolean {
  if (quoteExpiresAt == null) return false;
  const expires = Date.parse(quoteExpiresAt);
  return !Number.isNaN(expires) && expires <= now.getTime();
}

export function cancellationInsideWindow(
  cancelledAt: string,
  now: Date,
  validityHours: number,
): boolean {
  const at = Date.parse(cancelledAt);
  if (Number.isNaN(at)) return false;
  const start = now.getTime() - validityHours * 60 * 60 * 1000;
  return at >= start && at <= now.getTime();
}

function usableHours(hours: number | null): hours is number {
  return hours != null && Number.isInteger(hours) && hours >= 1;
}

export function deriveCartBlock(input: CartBlockInput, now: Date): CartBlock {
  const listing = input.listing;
  if (
    listing == null ||
    listing.deletedAt != null ||
    (listing.status !== "active" && listing.status !== "sold_out") ||
    input.storeStatus !== "active"
  ) {
    return { blockedReason: "stock", stockLabel: "unavailable" };
  }

  if (
    input.isCustom &&
    (!input.inquiryPresent || customQuoteExpired(input.quoteExpiresAt, now))
  ) {
    return { blockedReason: "quote_expired", stockLabel: null };
  }

  const tracked = listing.stockQty;
  if (
    listing.status === "sold_out" ||
    tracked === 0 ||
    (tracked != null && input.quantity > tracked)
  ) {
    return { blockedReason: "stock", stockLabel: "out_of_stock" };
  }

  return { blockedReason: null, stockLabel: null };
}

/**
 * One prompt per inquiry. Hours come from admin_settings (no fallback).
 * Any in-window cancellation qualifies. A future quote_expires_at does not.
 */
export function selectDroppedPrompts(
  rows: readonly DroppedInquiry[],
  now: Date,
  validityHours: number | null,
): DroppedInquiry[] {
  if (!usableHours(validityHours)) return [];
  const seen = new Set<string>();
  const kept: DroppedInquiry[] = [];
  for (const row of rows) {
    if (seen.has(row.inquiryId)) continue;
    if (row.hasCartLine) continue;
    if (row.status === "declined") continue;
    if (!quoteTimestampElapsed(row.quoteExpiresAt, now)) continue;
    const inWindow = row.cancelledAts.some((at) =>
      cancellationInsideWindow(at, now, validityHours),
    );
    if (!inWindow) continue;
    seen.add(row.inquiryId);
    kept.push(row);
  }
  return kept;
}

export function goodsSubtotal(lines: readonly { unitPrice: number; quantity: number }[]): number {
  const cents = lines.reduce(
    (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
    0,
  );
  return cents / 100;
}

export function asAmount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function firstEmbed<T>(value: T | readonly T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return (value as T | null | undefined) ?? null;
}
