// @vitest-environment jsdom
/**
 * P10-POST. The top-bar cart count refreshes when a cart write succeeds
 * on the current page. Add (P04) and quote accept (P14) dispatch
 * CART_UPDATED_EVENT once. A failed add does not. AppChrome re-reads
 * the count when that event fires.
 */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { ListingActionButtons } from "@/features/discovery/components/ListingActionButtons";
import { AcceptQuoteButton } from "@/app/[locale]/(buyer)/inbox/[id]/_components/AcceptQuoteButton";
import { AppChrome } from "@/app/[locale]/_components/AppChrome";
import { CART_UPDATED_EVENT } from "@/features/cart/cartEvents";

const addToCart = vi.hoisted(() => vi.fn());
const acceptInquiryQuote = vi.hoisted(() => vi.fn());
const getBuyerCartCount = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace: () => undefined, refresh: () => undefined }),
  Link: (props: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/features/discovery/hooks/useViewerListingAccess", () => ({
  useViewerListingAccess: () => ({ status: "authed", isOwnListing: false }),
}));

vi.mock("@/features/discovery/actions/addToCart", () => ({
  addToCart: (...args: unknown[]) => addToCart(...args),
}));

vi.mock("@/features/discovery/actions/toggleWishlist", () => ({
  toggleWishlist: async () => ({ ok: false, reason: "unauthenticated" }),
}));

vi.mock("@/features/messaging/components/InquiryComposer", () => ({
  InquiryComposer: () => null,
}));

vi.mock("@/features/messaging/actions/acceptInquiryQuote", () => ({
  acceptInquiryQuote: (...args: unknown[]) => acceptInquiryQuote(...args),
}));

vi.mock("@/features/cart/actions/getBuyerCartCount", () => ({
  getBuyerCartCount: (...args: unknown[]) => getBuyerCartCount(...args),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: () => undefined }),
}));

const INQUIRY = "22222222-2222-4222-8222-222222222222";

const buttonProps = {
  listingId: "11111111-1111-4111-8111-111111111111",
  storeId: "22222222-2222-4222-8222-222222222222",
  shareTitle: "Listing",
  isSoldOut: false,
  purchaseControl: "add" as const,
  wishlistAddLabel: "Save",
  wishlistRemoveLabel: "Unsave",
  inquiryLabel: "Request price",
  inquiryOwnListingReason: "Own listing",
  notifyMeLabel: "Notify me",
  addToCartLabel: "Add to cart",
  shareActionLabel: "Share",
  shareFallbackLabel: "Copy",
  shareCopiedLabel: "Copied",
  shareErrorLabel: "Could not share",
};

function renderWithMessages(node: React.ReactNode) {
  return render(
    React.createElement(NextIntlClientProvider, {
      locale: "en",
      messages: en,
      children: node,
    }),
  );
}

function cartUpdates(): { count: () => number; stop: () => void } {
  let seen = 0;
  const onUpdate = () => {
    seen += 1;
  };
  window.addEventListener(CART_UPDATED_EVENT, onUpdate);
  return {
    count: () => seen,
    stop: () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate),
  };
}

afterEach(() => {
  cleanup();
  addToCart.mockReset();
  acceptInquiryQuote.mockReset();
  getBuyerCartCount.mockReset();
  push.mockReset();
});

describe("P10-POST cart count", () => {
  it("dispatches the cart event once after a successful add", async () => {
    addToCart.mockResolvedValue({
      ok: true,
      cartItemId: "33333333-3333-4333-8333-333333333333",
    });
    const heard = cartUpdates();
    renderWithMessages(React.createElement(ListingActionButtons, buttonProps));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByText("Added to your cart.")).toBeTruthy();
    expect(heard.count()).toBe(1);
    heard.stop();
  });

  it("does not dispatch the cart event when the add fails", async () => {
    addToCart.mockResolvedValue({
      ok: false,
      reason: "refused",
      messageKey: "cartLineExists",
    });
    const heard = cartUpdates();
    renderWithMessages(React.createElement(ListingActionButtons, buttonProps));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByText("This item is already in your cart.")).toBeTruthy();
    expect(heard.count()).toBe(0);
    heard.stop();
  });

  it("dispatches the cart event once after a successful quote accept", async () => {
    acceptInquiryQuote.mockResolvedValue({
      ok: true,
      cartItemId: "33333333-3333-4333-8333-333333333333",
    });
    const heard = cartUpdates();
    renderWithMessages(
      React.createElement(AcceptQuoteButton, { inquiryId: INQUIRY, label: "Accept quote" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept quote" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/cart"));
    expect(heard.count()).toBe(1);
    heard.stop();
  });

  it("re-reads the cart count when the cart event fires", async () => {
    getBuyerCartCount.mockResolvedValue(0);
    renderWithMessages(React.createElement(AppChrome));
    await screen.findByRole("button", { name: "Cart, 0 items" });
    expect(getBuyerCartCount).toHaveBeenCalledTimes(1);
    getBuyerCartCount.mockResolvedValue(2);
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    const cart = await screen.findByRole("button", { name: "Cart, 2 items" });
    expect(getBuyerCartCount).toHaveBeenCalledTimes(2);
    expect(cart.querySelector(".bg-destructive")).toBeTruthy();
  });
});
