/** Dispatched after a cart write so the top-bar count refetches. Not a server module. */
export const CART_UPDATED_EVENT = "betk-cart-updated";

/** Ask AppChrome to re-read the signed-in cart count. Client only. */
export function notifyCartUpdated(): void {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}
