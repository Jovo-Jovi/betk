// @vitest-environment jsdom
/**
 * P10 T04. Every P10M1 exception code has a catalog key in ar and en.
 * An unknown error uses generic, never the raw code. P04 shows Add and
 * Request price exclusively. P36, P37, and P14 match the spec check.
 */

import * as React from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {
  P10_FUNCTION_ERROR_CODES,
  P10_ERROR_MESSAGE_KEYS,
  p10MessageKey,
  p10RefusalFromRpc,
} from "@/features/messaging/p10FunctionErrors";
import { listingPurchaseControl } from "@/features/discovery/listingPurchaseControl";
import { sendInquiryQuoteSchema } from "@/validations/messaging";
import { ListingActionButtons } from "@/features/discovery/components/ListingActionButtons";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const addToCart = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  Link: (props: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/features/discovery/hooks/useViewerListingAccess", () => ({
  useViewerListingAccess: () => ({ status: "guest" }),
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

afterEach(() => {
  cleanup();
  addToCart.mockReset();
});

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

const buttonProps = {
  listingId: "11111111-1111-4111-8111-111111111111",
  storeId: "22222222-2222-4222-8222-222222222222",
  shareTitle: "Listing",
  isSoldOut: false,
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

function renderButtons(purchaseControl: "add" | "request") {
  return render(
    React.createElement(NextIntlClientProvider, {
      locale: "en",
      messages: en,
      children: React.createElement(ListingActionButtons, { ...buttonProps, purchaseControl }),
    }),
  );
}

describe("P10 T04 error mapping", () => {
  it("lists every exception the migration raises, and no others", () => {
    const sql = read("supabase/migrations/20261006100204_v2_10_cart_quote.sql");
    const raised = [...sql.matchAll(/RAISE EXCEPTION '(BETK_[A-Z0-9_]+)'/g)].map((match) => match[1]!);
    expect(new Set(raised)).toEqual(new Set(P10_FUNCTION_ERROR_CODES));
    expect(raised.length).toBeGreaterThan(0);
  });

  it("gives every code a key in both catalogs, and unknown errors use generic", () => {
    for (const code of P10_FUNCTION_ERROR_CODES) {
      const key = P10_ERROR_MESSAGE_KEYS[code as keyof typeof P10_ERROR_MESSAGE_KEYS];
      expect(en.p10Errors[key as keyof typeof en.p10Errors]).toEqual(expect.any(String));
      expect(ar.p10Errors[key as keyof typeof ar.p10Errors]).toEqual(expect.any(String));
      expect(en.p10Errors[key as keyof typeof en.p10Errors].startsWith("BETK_")).toBe(false);
      expect(ar.p10Errors[key as keyof typeof ar.p10Errors].startsWith("BETK_")).toBe(false);
    }
    expect(en.p10Errors.generic).toEqual(expect.any(String));
    expect(ar.p10Errors.generic).toEqual(expect.any(String));
    expect(p10MessageKey("BETK_NOPE")).toBe("generic");
    const unknown = p10RefusalFromRpc({ message: "nope" });
    expect(unknown.reason).toBe("error");
    expect(unknown.messageKey).toBe("generic");
    expect(unknown.messageKey.startsWith("BETK_")).toBe(false);
  });
});

describe("P10 T04 purchase control", () => {
  it("returns add or request, never both", () => {
    expect(listingPurchaseControl({ price: 100, isMadeToOrder: false })).toBe("add");
    expect(listingPurchaseControl({ price: 100, isMadeToOrder: true })).toBe("request");
    expect(listingPurchaseControl({ price: null, isMadeToOrder: false })).toBe("request");
    expect(listingPurchaseControl({ price: null, isMadeToOrder: true })).toBe("request");
  });

  it("shows Add to cart only for add, and Request price only for request", () => {
    const add = renderButtons("add");
    expect(add.queryByRole("button", { name: "Add to cart" })).not.toBeNull();
    expect(add.queryByRole("button", { name: "Request price" })).toBeNull();
    cleanup();
    const request = renderButtons("request");
    expect(request.queryByRole("button", { name: "Request price" })).not.toBeNull();
    expect(request.queryByRole("button", { name: "Add to cart" })).toBeNull();
  });

  it("shows the catalog sentence and a cart link when the line already exists", async () => {
    addToCart.mockResolvedValue({
      ok: false,
      reason: "refused",
      messageKey: "cartLineExists",
    });
    const view = renderButtons("add");
    fireEvent.click(view.getByRole("button", { name: "Add to cart" }));
    expect(await view.findByText("This item is already in your cart.")).toBeTruthy();
    const link = view.getByRole("link", { name: "View cart" });
    expect(link.getAttribute("href")).toBe("/cart");
    expect(addToCart).toHaveBeenCalledTimes(1);
  });

  it("rejects a quote with no preparation time before any database call", () => {
    const parsed = sendInquiryQuoteSchema.safeParse({
      inquiryId: "11111111-1111-4111-8111-111111111111",
      quotedPrice: 100,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("P10 T04 screen contracts", () => {
  it("keeps P36 on the buyer label, with no confirm action and no buyer name", () => {
    const page = read("src/app/[locale]/(seller)/seller/inbox/page.tsx");
    expect(page).toContain('t("buyerLabel")');
    expect(page).not.toContain("confirmInquiry");
    expect(page).not.toContain("full_name");
    expect(page).not.toContain("buyer_profiles");
  });

  it("removes the confirm control on P37 and the checkout control on P14", () => {
    const status = read(
      "src/app/[locale]/(seller)/seller/inbox/[id]/_components/InquiryStatusActions.tsx",
    );
    expect(status).not.toContain("confirmInquiry");
    const buyer = read("src/app/[locale]/(buyer)/inbox/[id]/page.tsx");
    expect(buyer).not.toContain("routes.checkout");
    expect(buyer).not.toContain("checkout(");
    const send = read("src/features/messaging/actions/sendInquiryMessage.ts");
    expect(send).not.toContain("recomputeSellerAvgResponseHours");
  });

  it("maps function errors inside every calling action", () => {
    for (const rel of [
      "src/features/messaging/actions/sendInquiryQuote.ts",
      "src/features/messaging/actions/acceptInquiryQuote.ts",
      "src/features/discovery/actions/addToCart.ts",
      "src/features/discovery/actions/setCartItemQuantity.ts",
    ]) {
      expect(read(rel)).toContain("p10RefusalFromRpc");
    }
  });
});
