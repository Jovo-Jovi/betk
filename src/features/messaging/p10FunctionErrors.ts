/**
 * Maps every exception P10M1's functions raise to a `p10Errors` catalog key.
 * The action returns the key. The screen translates it. A raw `BETK_*` code
 * is never a return value. An unknown code uses `generic`.
 *
 * Raised by `add_fixed_cart_item`, `set_cart_item_quantity`,
 * `accept_inquiry_quote`, and `send_inquiry_quote`
 * (`supabase/migrations/20261006100204_v2_10_cart_quote.sql`).
 */

export const P10_ERROR_MESSAGE_KEYS = {
  BETK_UNAUTHENTICATED: "unauthenticated",
  BETK_CART_QUANTITY: "cartQuantity",
  BETK_CART_LISTING_UNAVAILABLE: "cartListingUnavailable",
  BETK_CART_STORE_INACTIVE: "cartStoreInactive",
  BETK_CART_NOT_FIXED: "cartNotFixed",
  BETK_CART_LINE_EXISTS: "cartLineExists",
  BETK_CART_OUT_OF_STOCK: "cartOutOfStock",
  BETK_CART_LINE_NOT_FOUND: "cartLineNotFound",
  BETK_QUOTE_NOT_FOUND: "quoteNotFound",
  BETK_QUOTE_DECLINED: "quoteDeclined",
  BETK_QUOTE_ABSENT: "quoteAbsent",
  BETK_QUOTE_EXPIRED: "quoteExpired",
  BETK_QUOTE_LISTING_UNAVAILABLE: "quoteListingUnavailable",
  BETK_QUOTE_STORE_INACTIVE: "quoteStoreInactive",
  BETK_QUOTE_NOT_OWNER: "quoteNotOwner",
  BETK_QUOTE_LINE_HELD: "quoteLineHeld",
  BETK_QUOTE_LISTING_INELIGIBLE: "quoteListingIneligible",
  BETK_QUOTE_PREP_REQUIRED: "quotePrepRequired",
  BETK_QUOTE_PRICE: "quotePrice",
  BETK_QUOTE_OUT_OF_BAND: "quoteOutOfBand",
  BETK_QUOTE_VALIDITY_UNCONFIGURED: "quoteValidityUnconfigured",
} as const;

export const P10_FUNCTION_ERROR_CODES = Object.keys(P10_ERROR_MESSAGE_KEYS);

export const P10_GENERIC_MESSAGE_KEY = "generic";

export type P10MessageKey =
  | (typeof P10_ERROR_MESSAGE_KEYS)[keyof typeof P10_ERROR_MESSAGE_KEYS]
  | typeof P10_GENERIC_MESSAGE_KEY;

export type P10FailureReason = "unauthenticated" | "not_found" | "refused" | "error";

export interface P10Failure {
  ok: false;
  reason: P10FailureReason;
  messageKey: P10MessageKey;
}

const NOT_FOUND_CODES = new Set<string>([
  "BETK_QUOTE_NOT_FOUND",
  "BETK_QUOTE_NOT_OWNER",
  "BETK_CART_LINE_NOT_FOUND",
]);

export function p10MessageKey(code: string): P10MessageKey {
  const key = (P10_ERROR_MESSAGE_KEYS as Record<string, P10MessageKey | undefined>)[code];
  return key ?? P10_GENERIC_MESSAGE_KEY;
}

export function p10CodeFromText(text: string): string | null {
  return text.match(/BETK_[A-Z0-9_]+/)?.[0] ?? null;
}

export function p10RefusalFromRpc(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
}): P10Failure {
  const code = p10CodeFromText(
    `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`,
  );
  if (!code) {
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }
  const messageKey = p10MessageKey(code);
  if (messageKey === P10_GENERIC_MESSAGE_KEY) {
    return { ok: false, reason: "error", messageKey };
  }
  if (code === "BETK_UNAUTHENTICATED") {
    return { ok: false, reason: "unauthenticated", messageKey };
  }
  if (NOT_FOUND_CODES.has(code)) {
    return { ok: false, reason: "not_found", messageKey };
  }
  return { ok: false, reason: "refused", messageKey };
}
