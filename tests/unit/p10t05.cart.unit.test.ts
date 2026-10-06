// @vitest-environment jsdom
/**
 * P10 T05. Cart page rules and both entry points.
 * R-NEWQUOTE deletes the held line, then opens the thread.
 * R-DROPPED is a read-time window from quote_validity_hours.
 * R-BLOCKED follows checkout_from_cart's predicates.
 */

import * as React from "react";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {
  deriveCartBlock,
  goodsSubtotal,
  selectDroppedPrompts,
  type CartBlockInput,
  type DroppedInquiry,
} from "@/features/cart/cartRules";
import { releaseHeldQuoteLine } from "@/features/cart/actions/releaseHeldQuoteLine";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { AppChrome } from "@/app/[locale]/_components/AppChrome";
import { CartView } from "@/app/[locale]/(buyer)/cart/_components/CartView";
import type { CartPageLine, DroppedQuotePrompt } from "@/features/cart/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINE = "11111111-1111-4111-8111-111111111111";
const LINE_2 = "33333333-3333-4333-8333-333333333333";
const INQUIRY = "22222222-2222-4222-8222-222222222222";
const INQUIRY_2 = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-10-06T12:00:00.000Z");

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const db = vi.hoisted(() => ({
  calls: [] as string[],
  creates: 0,
  line: null as null | {
    id: string;
    is_custom: boolean;
    inquiry_id: string | null;
    inquiries: { quote_expires_at: string | null } | null;
  },
  deleted: [] as { id: string }[],
}));

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const setCartItemQuantity = vi.hoisted(() => vi.fn());
const removeCartItem = vi.hoisted(() => vi.fn());
const getBuyerCartCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    db.creates += 1;
    const read = {
      select() {
        return read;
      },
      eq() {
        return read;
      },
      maybeSingle: async () => ({ data: db.line, error: null }),
    };
    const del = {
      eq() {
        return del;
      },
      select: async () => ({ data: db.deleted, error: null }),
    };
    return {
      schema() {
        return {
          from() {
            return {
              select() {
                return read;
              },
              delete() {
                db.calls.push("delete");
                return del;
              },
            };
          },
          rpc() {
            db.calls.push("rpc");
            return Promise.resolve({ data: null, error: { message: "BETK_QUOTE_LINE_HELD" } });
          },
        };
      },
    };
  },
}));

vi.mock("@/features/auth", () => {
  class NotAuthenticatedError extends Error {}
  class UserDeactivatedError extends Error {}
  class UserNotActiveError extends Error {}
  return {
    requireActiveUser: async () => ({ id: "buyer-1" }),
    NotAuthenticatedError,
    UserDeactivatedError,
    UserNotActiveError,
  };
});

vi.mock("@/services/sentry", () => ({
  setFeatureContext: () => undefined,
  captureTaggedError: () => undefined,
}));

vi.mock("@/features/discovery/actions/setCartItemQuantity", () => ({
  setCartItemQuantity: (...args: unknown[]) => setCartItemQuantity(...args),
}));

vi.mock("@/features/cart/actions/removeCartItem", () => ({
  removeCartItem: (...args: unknown[]) => removeCartItem(...args),
}));

vi.mock("@/features/cart/actions/getBuyerCartCount", () => ({
  getBuyerCartCount: (...args: unknown[]) => getBuyerCartCount(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace: () => undefined, refresh }),
  Link: (props: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: () => undefined }),
}));

afterEach(() => {
  cleanup();
  db.calls = [];
  db.creates = 0;
  db.line = null;
  db.deleted = [];
  push.mockReset();
  refresh.mockReset();
  setCartItemQuantity.mockReset();
  removeCartItem.mockReset();
  getBuyerCartCount.mockReset();
});

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

function block(overrides: Partial<CartBlockInput> = {}) {
  return deriveCartBlock(
    {
      isCustom: false,
      quantity: 1,
      quoteExpiresAt: null,
      inquiryPresent: false,
      listing: { status: "active", deletedAt: null, stockQty: 5 },
      storeStatus: "active",
      ...overrides,
    },
    NOW,
  );
}

function hoursBefore(hours: number, extraMs = 0): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000 - extraMs).toISOString();
}

function dropped(overrides: Partial<DroppedInquiry> = {}): DroppedInquiry {
  return {
    inquiryId: INQUIRY,
    quoteExpiresAt: hoursBefore(1),
    status: "replied",
    hasCartLine: false,
    cancelledAts: [hoursBefore(5)],
    ...overrides,
  };
}

function line(overrides: Partial<CartPageLine> = {}): CartPageLine {
  return {
    lineId: LINE,
    title: "Bowl",
    unitPrice: 100,
    quantity: 2,
    isCustom: false,
    stockQty: 5,
    quoteExpiresAt: null,
    inquiryId: null,
    storeName: "Shop",
    blockedReason: null,
    stockLabel: null,
    ...overrides,
  };
}

function renderCart(lines: CartPageLine[], prompts: DroppedQuotePrompt[] = []) {
  return render(
    React.createElement(NextIntlClientProvider, {
      locale: "en",
      messages: en,
      children: React.createElement(CartView, { lines, dropped: prompts, currencyLabel: "EGP" }),
    }),
  );
}

function renderChrome() {
  return render(
    React.createElement(NextIntlClientProvider, {
      locale: "en",
      messages: en,
      children: React.createElement(AppChrome),
    }),
  );
}

describe("R-BLOCKED", () => {
  it("blocks sold_out, zero stock, and quantity above tracked stock", () => {
    expect(block({ listing: { status: "sold_out", deletedAt: null, stockQty: 5 } })).toEqual({
      blockedReason: "stock",
      stockLabel: "out_of_stock",
    });
    expect(block({ listing: { status: "active", deletedAt: null, stockQty: 0 } })).toEqual({
      blockedReason: "stock",
      stockLabel: "out_of_stock",
    });
    expect(
      block({ quantity: 3, listing: { status: "active", deletedAt: null, stockQty: 2 } }),
    ).toEqual({ blockedReason: "stock", stockLabel: "out_of_stock" });
    expect(
      block({ quantity: 2, listing: { status: "active", deletedAt: null, stockQty: 2 } }).blockedReason,
    ).toBeNull();
    expect(
      block({ listing: { status: "active", deletedAt: null, stockQty: null } }).blockedReason,
    ).toBeNull();
  });

  it("blocks an expired custom quote, including a null expiry", () => {
    expect(
      block({
        isCustom: true,
        inquiryPresent: true,
        quoteExpiresAt: hoursBefore(1),
      }),
    ).toEqual({ blockedReason: "quote_expired", stockLabel: null });
    expect(
      block({
        isCustom: true,
        inquiryPresent: true,
        quoteExpiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
      }).blockedReason,
    ).toBeNull();
    expect(
      block({ isCustom: true, inquiryPresent: true, quoteExpiresAt: null }).blockedReason,
    ).toBe("quote_expired");
  });

  it("uses the unavailable label when the listing or the store is gone", () => {
    const unavailable = { blockedReason: "stock", stockLabel: "unavailable" } as const;
    expect(block({ listing: { status: "paused", deletedAt: null, stockQty: 5 } })).toEqual(unavailable);
    expect(block({ listing: { status: "draft", deletedAt: null, stockQty: 5 } })).toEqual(unavailable);
    expect(block({ listing: { status: "removed", deletedAt: null, stockQty: 5 } })).toEqual(unavailable);
    expect(
      block({ listing: { status: "active", deletedAt: "2026-01-01T00:00:00.000Z", stockQty: 5 } }),
    ).toEqual(unavailable);
    expect(block({ listing: null })).toEqual(unavailable);
    expect(block({ storeStatus: "suspended" })).toEqual(unavailable);
    expect(block({ storeStatus: null })).toEqual(unavailable);
    expect(
      block({
        isCustom: true,
        inquiryPresent: true,
        quoteExpiresAt: hoursBefore(1),
        storeStatus: "suspended",
      }),
    ).toEqual(unavailable);
  });
});

describe("R-DROPPED", () => {
  it("shows a prompt inside the configured window", () => {
    expect(selectDroppedPrompts([dropped()], NOW, 10)).toHaveLength(1);
    expect(selectDroppedPrompts([dropped({ cancelledAts: [hoursBefore(10)] })], NOW, 10)).toHaveLength(1);
  });

  it("hides a prompt outside the window, without treating 24 as the window", () => {
    expect(selectDroppedPrompts([dropped({ cancelledAts: [hoursBefore(20)] })], NOW, 10)).toHaveLength(0);
    expect(selectDroppedPrompts([dropped({ cancelledAts: [hoursBefore(10, 1)] })], NOW, 10)).toHaveLength(0);
    expect(selectDroppedPrompts([dropped({ cancelledAts: [hoursBefore(20)] })], NOW, 48)).toHaveLength(1);
    expect(selectDroppedPrompts([dropped()], NOW, null)).toHaveLength(0);
  });

  it("hides the prompt once a fresh quote exists", () => {
    const fresh = new Date(NOW.getTime() + 60_000).toISOString();
    expect(selectDroppedPrompts([dropped({ quoteExpiresAt: fresh })], NOW, 10)).toHaveLength(0);
    expect(selectDroppedPrompts([dropped({ quoteExpiresAt: NOW.toISOString() })], NOW, 10)).toHaveLength(1);
    expect(selectDroppedPrompts([dropped({ status: "declined" })], NOW, 10)).toHaveLength(0);
    expect(selectDroppedPrompts([dropped({ hasCartLine: true })], NOW, 10)).toHaveLength(0);
    const rows = selectDroppedPrompts(
      [dropped(), dropped({ inquiryId: INQUIRY_2, cancelledAts: [hoursBefore(20)] })],
      NOW,
      10,
    );
    expect(rows.map((row) => row.inquiryId)).toEqual([INQUIRY]);
  });
});

describe("cart page", () => {
  it("changes the goods subtotal on quantity and remove, and shows no delivery figure", async () => {
    setCartItemQuantity.mockResolvedValue({ ok: true });
    removeCartItem.mockResolvedValue({ ok: true });
    renderCart([
      line(),
      line({ lineId: LINE_2, title: "Plate", unitPrice: 50, quantity: 1 }),
    ]);

    const subtotal = screen.getByText("Goods subtotal").parentElement;
    expect(subtotal?.textContent).toContain("250");
    const delivery = screen.getByText("Delivery is calculated at checkout");
    expect(delivery.textContent).not.toMatch(/\d/);
    expect(screen.queryByText(/grand total/i)).toBeNull();

    fireEvent.click(within(screen.getByRole("group", { name: "Plate" })).getByRole("button", { name: "Increase quantity" }));
    await waitFor(() => expect(subtotal?.textContent).toContain("300"));

    fireEvent.click(within(screen.getByRole("group", { name: "Plate" })).getByRole("button", { name: "Remove" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove from cart" }));
    await waitFor(() => expect(subtotal?.textContent).toContain("200"));
    expect(goodsSubtotal([{ unitPrice: 10.5, quantity: 2 }])).toBe(21);
  });

  it("keeps the previous quantity when the change is refused", async () => {
    setCartItemQuantity.mockResolvedValue({ ok: false, reason: "refused", messageKey: "generic" });
    renderCart([line()]);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not update this item.");
    expect(screen.getByText("Goods subtotal").parentElement?.textContent).toContain("200");
  });

  it("shows the unavailable label and the out-of-stock label on different lines", () => {
    renderCart([
      line({ title: "Paused item", blockedReason: "stock", stockLabel: "unavailable" }),
      line({
        lineId: LINE_2,
        title: "Empty item",
        blockedReason: "stock",
        stockLabel: "out_of_stock",
      }),
    ]);
    const paused = within(screen.getByRole("group", { name: "Paused item" }));
    const empty = within(screen.getByRole("group", { name: "Empty item" }));
    expect(paused.getByText("No longer available")).toBeTruthy();
    expect(paused.queryByText("Out of stock")).toBeNull();
    expect(empty.getByText("Out of stock")).toBeTruthy();
    expect(empty.queryByText("No longer available")).toBeNull();
  });
});

describe("R-NEWQUOTE", () => {
  it("deletes the held line before opening the thread", async () => {
    db.line = {
      id: LINE,
      is_custom: true,
      inquiry_id: INQUIRY,
      inquiries: { quote_expires_at: "2020-01-01T00:00:00.000Z" },
    };
    db.deleted = [{ id: LINE }];
    push.mockImplementation(() => {
      expect(db.calls).toEqual(["delete"]);
      expect(screen.queryByRole("group", { name: "Custom bowl" })).toBeNull();
    });
    renderCart([
      line({
        title: "Custom bowl",
        isCustom: true,
        inquiryId: INQUIRY,
        blockedReason: "quote_expired",
        quoteExpiresAt: "2020-01-01T00:00:00.000Z",
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Request a new quote" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/inbox/${INQUIRY}`));
    expect(db.calls).not.toContain("rpc");
    expect(screen.queryByRole("group", { name: "Custom bowl" })).toBeNull();
  });

  it("does not delete or navigate when the quote is still valid", async () => {
    db.line = {
      id: LINE,
      is_custom: true,
      inquiry_id: INQUIRY,
      inquiries: { quote_expires_at: "2099-01-01T00:00:00.000Z" },
    };
    const result = await releaseHeldQuoteLine({ cartItemId: LINE });
    expect(result.ok).toBe(false);
    expect(db.calls).not.toContain("delete");
    expect(db.calls).not.toContain("rpc");
  });

  it("does not delete a line that is not a held custom quote", async () => {
    db.line = { id: LINE, is_custom: false, inquiry_id: null, inquiries: null };
    const result = await releaseHeldQuoteLine({ cartItemId: LINE });
    expect(result.ok).toBe(false);
    expect(db.calls).not.toContain("delete");
  });

  it("validates the id before any database call", async () => {
    const result = await releaseHeldQuoteLine({ cartItemId: "nope" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(db.creates).toBe(0);
  });

  it("does not open the thread when the delete removes nothing", async () => {
    db.line = {
      id: LINE,
      is_custom: true,
      inquiry_id: INQUIRY,
      inquiries: { quote_expires_at: "2020-01-01T00:00:00.000Z" },
    };
    db.deleted = [];
    renderCart([
      line({
        title: "Custom bowl",
        isCustom: true,
        inquiryId: INQUIRY,
        blockedReason: "quote_expired",
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Request a new quote" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Custom bowl" })).toBeTruthy();
  });
});

describe("dropped prompt", () => {
  it("shows cartLine.droppedQuote and opens the thread without deleting", () => {
    renderCart(
      [],
      [{ inquiryId: INQUIRY, title: "Old bowl", storeName: "Shop", unitPrice: 40, quantity: 1 }],
    );
    expect(screen.getByText("This quote expired after the order was cancelled.")).toBeTruthy();
    expect(screen.queryByText("Goods subtotal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Request a new quote" }));
    expect(push).toHaveBeenCalledWith(`/inbox/${INQUIRY}`);
    expect(db.calls).not.toContain("delete");
    expect(screen.getByRole("group", { name: "Old bowl" })).toBeTruthy();
  });
});

describe("entry points", () => {
  it("keeps the top bar unchanged when no cart props are passed", () => {
    render(React.createElement(AppTopbar));
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Cart/ })).toBeNull();
  });

  it("copies the notifications button and puts the count in the name only", () => {
    const { unmount } = render(
      React.createElement(AppTopbar, {
        onCartClick: () => undefined,
        cartCount: 3,
        cartLabel: "Cart, 3 items",
      }),
    );
    const cart = screen.getByRole("button", { name: "Cart, 3 items" });
    const notif = screen.getByRole("button", { name: "الإشعارات" });
    expect(cart.className).toBe(notif.className);
    expect(cart.textContent ?? "").not.toMatch(/\d/);
    expect(cart.querySelector(".bg-destructive")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(6);
    unmount();

    render(
      React.createElement(AppTopbar, {
        onCartClick: () => undefined,
        cartCount: 0,
        cartLabel: "Cart, 0 items",
      }),
    );
    expect(screen.getByRole("button", { name: "Cart, 0 items" }).querySelector(".bg-destructive")).toBeNull();
  });

  it("shows a Cart tab and a dotted top-bar button when the count is above zero", async () => {
    getBuyerCartCount.mockResolvedValue(4);
    renderChrome();
    expect(screen.queryByRole("button", { name: "Cart, 4 items" })).toBeNull();
    const cart = await screen.findByRole("button", { name: "Cart, 4 items" });
    expect(cart.textContent ?? "").not.toMatch(/\d/);
    expect(cart.querySelector(".bg-destructive")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Cart$/ }));
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("shows the top-bar button without a dot when the count is zero", async () => {
    getBuyerCartCount.mockResolvedValue(0);
    renderChrome();
    const cart = await screen.findByRole("button", { name: "Cart, 0 items" });
    expect(cart.querySelector(".bg-destructive")).toBeNull();
  });

  it("passes no cart props for a guest", async () => {
    getBuyerCartCount.mockResolvedValue(null);
    renderChrome();
    await waitFor(() => expect(getBuyerCartCount).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Cart,/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Cart$/ })).toBeTruthy();
  });
});

describe("contracts", () => {
  it("locks the page, the pin, P13, and the sanctioned files", () => {
    expect(read("scripts/check-page-count.mjs")).toContain("export const PINNED_PAGE_COUNT = 32");
    expect(read("scripts/check-page-count.mjs")).toContain("export const OD21_PAGE_FREEZE = 79");
    expect(existsSync(resolve(root, "src/app/[locale]/(buyer)/cart/page.tsx"))).toBe(true);

    const page = read("src/app/[locale]/(buyer)/cart/page.tsx");
    expect(page).not.toContain("checkout_from_cart");
    expect(page).not.toContain("notFound(");
    expect(read("src/app/[locale]/(buyer)/cart/_components/CartView.tsx")).not.toContain("checkout_from_cart");
    expect(read("src/app/[locale]/(buyer)/cart/_components/CartView.tsx")).not.toContain("send_inquiry_quote");
    const release = read("src/features/cart/actions/releaseHeldQuoteLine.ts").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(release).not.toContain("send_inquiry_quote");
    expect(release).not.toContain(".rpc(");
    expect(read("src/app/[locale]/(buyer)/inbox/page.tsx")).not.toMatch(/checkout/i);
    expect(read("src/middleware.ts")).toContain('"/cart"');
    expect(read("src/services/quoteValidityHours.ts")).not.toMatch(/\b24\b/);
    expect(read("src/features/cart/cartRules.ts")).not.toMatch(/\b24\b/);
    expect(read("src/features/discovery/actions/addToCart.ts")).toContain("unauthenticated");

    const query = read("src/features/cart/queries/getCartPage.ts");
    expect(query).toContain("order_status_history");
    expect(query).toContain("created_at");
    expect(query).toContain("order_status_history_access");
    expect(query).not.toContain("supabase/service");
    expect(query).toContain('.select(CANCELLED_ORDERS_SELECT)');
    expect(query).not.toContain('select("*")');

    expect(read("src/components/shared/MobileBottomNav.tsx")).not.toContain("cart");
    expect(read("src/app/[locale]/_components/AppChrome.tsx")).toContain(
      '"home", "search", "wishlist", "cart", "inbox", "account"',
    );
    const topbar = read("src/components/shared/AppTopbar.tsx");
    expect(topbar).toContain("onCartClick");
    expect(topbar).toContain("cartCount");
    expect(topbar).toContain("cartLabel");
    expect(topbar).toContain("ShoppingCart");

    const session = read("docs/10-ai-development/SESSION_CONTEXT.md");
    const row = session.split("\n").find((entry) => entry.startsWith("| REG-114 |"));
    expect(row).toContain("Closed — **P10-T05");

    expect(en.cart.deliveryCalculated).not.toMatch(/\d/);
    expect(ar.cart.deliveryCalculated).not.toMatch(/\d/);
    expect(en.cartLine.droppedQuote.length).toBeGreaterThan(0);
    expect(ar.cartLine.droppedQuote.length).toBeGreaterThan(0);
    expect(en.cartLine.blockedUnavailable).not.toBe(en.cartLine.blockedStock);
    expect(ar.cartLine.blockedUnavailable).not.toBe(ar.cartLine.blockedStock);
  });
});
