// @vitest-environment jsdom
/**
 * P09 T07 E4. P33 composes DataTable. The first cell is a link built from
 * the edit route helper. The row is not a click handler. P30 is not DataTable.
 */

import * as React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { routes, withLocale } from "@/constants/routes";
import { InventoryTable } from "@/app/[locale]/(seller)/seller/inventory/_components/InventoryTable";
import type { OwnInventoryItem } from "@/features/listings";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));

vi.mock("@/features/listings/actions/updateStock", () => ({
  updateStock: async () => ({ ok: true, restocked: false }),
}));

afterEach(cleanup);

const item: OwnInventoryItem = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "product",
  titleAr: "منتج",
  titleEn: "Product",
  status: "active",
  stockQty: 4,
  lowStockThreshold: 3,
  isMadeToOrder: false,
  stockTouchedAt: "2026-10-04T00:00:00.000Z",
  heroImageUrl: null,
};

function wrap(node: React.ReactElement) {
  return React.createElement(NextIntlClientProvider, {
    locale: "en",
    messages: en,
    children: node,
  });
}

describe("P09 T07 — P33 DataTable", () => {
  it("links the first cell to the edit route and does not make the row a button", () => {
    const view = render(wrap(React.createElement(InventoryTable, { items: [item] })));
    const href = withLocale(routes.seller.listingEdit(item.id), "en");
    const link = view.container.querySelector("table a");
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.textContent).toContain("Product");
    const row = link?.closest("tr");
    expect(row?.getAttribute("onclick")).toBeNull();
    expect(row?.querySelector("button")).toBeNull();
  });

  it("does not compose DataTable on P30", () => {
    const source = readFileSync("src/app/[locale]/(seller)/seller/listings/_components/ListingsList.tsx", "utf8");
    expect(source.includes("DataTable")).toBe(false);
    expect(source.includes("rowHref")).toBe(false);
  });
});
