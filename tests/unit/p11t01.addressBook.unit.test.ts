// @vitest-environment jsdom
/**
 * P11 T01. Address book: one default statement, no fullName/phone write,
 * no silent replacement after deleting the default, Guard F pin 33.
 *
 * createElement keeps this file a `.ts` so Vitest's include picks it up.
 */

import * as React from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import { assignSingleDefault } from "@/features/buyer-account/assignSingleDefault";
import type { AddressListItem } from "@/features/buyer-account/queries/getOwnAddresses";
import { createAddressSchema } from "@/validations/address";
import { AddressBook } from "@/app/[locale]/(buyer)/account/addresses/_components/AddressBook";
import { addressWriteInput } from "@/app/[locale]/(buyer)/account/addresses/_components/addressWriteInput";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const setDefaultAddress = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/buyer-account/actions/createAddress", () => ({
  createAddress: vi.fn(),
}));
vi.mock("@/features/buyer-account/actions/updateAddress", () => ({
  updateAddress: vi.fn(),
}));
vi.mock("@/features/buyer-account/actions/deleteAddress", () => ({
  deleteAddress: vi.fn(),
}));
vi.mock("@/features/buyer-account/actions/setDefaultAddress", () => ({
  setDefaultAddress,
}));

const HOME = {
  id: "11111111-1111-4111-8111-111111111111",
  buyer_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  label: "Home",
  governorate: "cairo",
  city: "Maadi",
  street_address: "12 Nile",
  building_notes: null,
};
const WORK = {
  id: "22222222-2222-4222-8222-222222222222",
  buyer_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  label: "Work",
  governorate: "giza",
  city: "Dokki",
  street_address: "4 Tahrir",
  building_notes: "floor 2",
};
const OWNED = [HOME, WORK];

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function renderBook(addresses: AddressListItem[]) {
  return render(
    React.createElement(NextIntlClientProvider, {
      locale: "en",
      messages: en,
      children: React.createElement(AddressBook, { addresses }),
    }),
  );
}

afterEach(() => {
  cleanup();
  setDefaultAddress.mockReset();
});

describe("assignSingleDefault", () => {
  it("sets the chosen row true and the others false in one upsert", async () => {
    const writes: unknown[] = [];
    const client = {
      schema() {
        return {
          from() {
            return {
              select() {
                return {
                  eq: async () => ({ data: OWNED, error: null }),
                };
              },
              upsert: async (rows: unknown[]) => {
                writes.push(rows);
                return { error: null };
              },
              update() {
                throw new Error("set-default must not update twice");
              },
            };
          },
        };
      },
    };

    const result = await assignSingleDefault(client as never, HOME.buyer_id, WORK.id);

    expect(result).toEqual({ ok: true });
    expect(writes).toHaveLength(1);
    const written = writes[0] as { id: string; is_default: boolean }[] | undefined;
    expect(written?.filter((row) => row.is_default).map((row) => row.id)).toEqual([WORK.id]);
    expect(written?.filter((row) => !row.is_default).map((row) => row.id)).toEqual([HOME.id]);
  });

  it("does not write when the address is not one of the buyer's rows", async () => {
    let upserts = 0;
    const client = {
      schema() {
        return {
          from() {
            return {
              select() {
                return { eq: async () => ({ data: OWNED, error: null }) };
              },
              upsert: async () => {
                upserts += 1;
                return { error: null };
              },
            };
          },
        };
      },
    };

    const result = await assignSingleDefault(
      client as never,
      HOME.buyer_id,
      "33333333-3333-4333-8333-333333333333",
    );
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(upserts).toBe(0);
  });
});

describe("address columns", () => {
  it("rejects fullName and phone before a write", () => {
    const parsed = createAddressSchema.safeParse({
      governorate: "cairo",
      city: "Maadi",
      streetAddress: "12 Nile",
      fullName: "Nour",
      phone: "+201000000000",
    });
    expect(parsed.success).toBe(false);
  });

  it("drops fullName and phone when mapping the kit form", () => {
    const input = addressWriteInput(
      {
        fullName: "Nour",
        phone: "+201000000000",
        governorate: "cairo",
        city: "Maadi",
        addressLine: "12 Nile",
        notes: "floor 2",
      },
      "Home",
      false,
    );
    expect(input).not.toHaveProperty("fullName");
    expect(input).not.toHaveProperty("phone");
    expect(input).toMatchObject({
      label: "Home",
      governorate: "cairo",
      city: "Maadi",
      streetAddress: "12 Nile",
      buildingNotes: "floor 2",
      makeDefault: false,
    });
  });

  it("does not put is_default, fullName, or phone on the insert", () => {
    const source = read("src/features/buyer-account/actions/createAddress.ts");
    const insertStart = source.indexOf(".insert(");
    const insertEnd = source.indexOf(".select(", insertStart);
    const insertBlock = source.slice(insertStart, insertEnd);
    expect(insertBlock).not.toContain("is_default");
    expect(insertBlock).not.toContain("fullName");
    expect(insertBlock).not.toContain("phone");
    expect(source).toContain("assignSingleDefault");
  });

  it("deletes without choosing another default", () => {
    const source = read("src/features/buyer-account/actions/deleteAddress.ts");
    expect(source).not.toContain("assignSingleDefault");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".upsert(");
  });

  it("set-default is the one upsert, not two updates", () => {
    const assign = read("src/features/buyer-account/assignSingleDefault.ts");
    expect(assign.match(/\.upsert\(/g)).toHaveLength(1);
    expect(assign).not.toContain(".update(");
    const action = read("src/features/buyer-account/actions/setDefaultAddress.ts");
    expect(action).toContain("assignSingleDefault");
    expect(action).not.toContain(".update(");
    expect(action).not.toContain(".upsert(");
  });
});

describe("address book page", () => {
  it("shows an empty book and a no-default line", () => {
    renderBook([]);
    expect(screen.getByText("No saved addresses")).toBeTruthy();

    cleanup();
    const rows: AddressListItem[] = [
      {
        id: HOME.id,
        label: "Home",
        governorate: "cairo",
        city: "Maadi",
        streetAddress: "12 Nile",
        buildingNotes: null,
        isDefault: false,
      },
      {
        id: WORK.id,
        label: "Work",
        governorate: "giza",
        city: "Dokki",
        streetAddress: "4 Tahrir",
        buildingNotes: null,
        isDefault: false,
      },
    ];
    renderBook(rows);
    expect(screen.getByText("No default address")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Set as default" })).toHaveLength(2);
  });

  it("hides the no-default line when one address is the default", () => {
    renderBook([
      {
        id: HOME.id,
        label: "Home",
        governorate: "cairo",
        city: "Maadi",
        streetAddress: "12 Nile",
        buildingNotes: null,
        isDefault: true,
      },
    ]);
    expect(screen.queryByText("No default address")).toBeNull();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Set as default" })).toBeNull();
  });

  it("sends the chosen id to set-default", async () => {
    setDefaultAddress.mockResolvedValue({ ok: true });
    renderBook([
      {
        id: WORK.id,
        label: "Work",
        governorate: "giza",
        city: "Dokki",
        streetAddress: "4 Tahrir",
        buildingNotes: null,
        isDefault: false,
      },
    ]);
    screen.getByRole("button", { name: "Set as default" }).click();
    await vi.waitFor(() => {
      expect(setDefaultAddress).toHaveBeenCalledWith({ id: WORK.id });
    });
  });
});

describe("Guard F", () => {
  it("pins 33 built pages and leaves OD-21 at 79", () => {
    const pin = read("scripts/check-page-count.mjs");
    expect(pin).toContain("export const PINNED_PAGE_COUNT = 33");
    expect(pin).toContain("export const OD21_PAGE_FREEZE = 79");
    const book = read("src/app/[locale]/(buyer)/account/addresses/_components/AddressBook.tsx");
    expect(book).toContain("AddressForm");
    expect(book).toContain("EmptyState");
    expect(book).toContain("ConfirmDialog");
  });
});
