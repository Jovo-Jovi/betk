/**
 * Maps a Postgres refusal from the listings publish trigger or the shipping
 * check onto a stable code. The code is an i18n key. The raw database
 * sentence never leaves the server action.
 *
 * Longer codes are matched first so BETK_PREP_CAP does not swallow
 * BETK_PREP_CAP_UNCONFIGURED, and the same for the price-band pair.
 */

export const LISTING_REFUSAL_CODES = [
  "BETK_LISTING_TYPE",
  "BETK_PRICE_TYPE",
  "BETK_PREP_CAP_UNCONFIGURED",
  "BETK_PREP_CAP",
  "BETK_PRICE_BAND_UNCONFIGURED",
  "BETK_PRICE_BAND",
  "BETK_CATEGORY_NOT_APPROVED",
  "BETK_FOOD_REQUIREMENTS_UNCONFIGURED",
  "BETK_FOOD_APPROVAL_REQUIRED",
  "SHIPPING",
] as const;

export type ListingRefusalCode = (typeof LISTING_REFUSAL_CODES)[number];

const BETK_CODES = LISTING_REFUSAL_CODES.filter((code) => code.startsWith("BETK_"));

export function listingRefusalCode(message: string | null | undefined): ListingRefusalCode | null {
  if (!message) return null;
  if (message.includes("chk_active_listing_shipping")) return "SHIPPING";
  for (const code of BETK_CODES) {
    if (message.includes(code)) return code;
  }
  return null;
}
