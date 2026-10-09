/**
 * P04 purchase control (D2, R-Q01, AC-QTE-6).
 * Add to cart only for a priced listing that is not made-to-order.
 * Request price only for a made-to-order or unpriced listing.
 * The two results are exclusive.
 */

export type ListingPurchaseControl = "add" | "request";

export function listingPurchaseControl(listing: {
  price: number | null;
  isMadeToOrder: boolean;
}): ListingPurchaseControl {
  if (listing.isMadeToOrder || listing.price === null) return "request";
  return "add";
}
