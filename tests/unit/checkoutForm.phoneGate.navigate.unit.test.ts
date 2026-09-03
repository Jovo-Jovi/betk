// @vitest-environment jsdom
/**
 * CheckoutForm phone-gate routing — Phase 07 T03-evidence-topup (STEP 1b,
 * OD-4 loop). `createOrderFromInquiry`'s `phone_required` OUTCOME is already
 * integration-proven end-to-end (`tests/integration/orderPayment.writeLayer.
 * test.ts` — "createOrderFromInquiry: phone-NULL buyer → phone_required
 * (OD-4)"); that only proves the SERVER decision. This test closes the
 * CLIENT half: does the component that RECEIVES that outcome actually
 * navigate the phone-NULL buyer to `/auth/phone`? Mirrors the
 * `wishlistButton.navigate.unit.test.ts` precedent — mock the boundary (the
 * Server Action + the locale router + next-intl), render the REAL
 * `CheckoutForm`, drive a REAL click, assert the REAL router call.
 *
 * FINDING (reported, not fixed here — see the task report / SESSION_CONTEXT
 * for the accept/REG decision): `/checkout/page.tsx` performs NO phone
 * pre-check (it only checks `user` auth before rendering the form) — this
 * gate fires ONLY here, on submit, after a phone-NULL buyer has already
 * filled in the address/delivery/deposit form.
 */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { pushMock, createOrderFromInquiryMock, createAddressMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createOrderFromInquiryMock: vi.fn(),
  createAddressMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/features/checkout/actions/createOrderFromInquiry", () => ({
  createOrderFromInquiry: createOrderFromInquiryMock,
}));
vi.mock("@/features/buyer-account/actions/createAddress", () => ({
  createAddress: createAddressMock,
}));

import { CheckoutForm } from "@/app/[locale]/(buyer)/checkout/_components/CheckoutForm";
import type { CheckoutContext } from "@/features/checkout";
import type { AddressListItem } from "@/features/buyer-account";

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  createOrderFromInquiryMock.mockClear();
  createAddressMock.mockClear();
});

// Fully-populated context so `handleSubmit`'s pre-checks (address/delivery/
// deposit all selected) pass on the FIRST click — no Select interaction
// needed, isolating the assertion to the phone-gate routing branch alone.
const CONTEXT: CheckoutContext = {
  inquiryId: "11111111-1111-1111-1111-111111111111",
  status: "confirmed",
  convertedToOrderId: null,
  storeId: "22222222-2222-2222-2222-222222222222",
  listing: {
    id: "33333333-3333-3333-3333-333333333333",
    titleAr: "منتج",
    titleEn: null,
    unitPrice: 100,
  },
  quantity: 1,
  amounts: { subtotal: 100, deliveryFee: 0, total: 100, deposit: 50, balance: 50 },
  handles: { instapay: "01000000000", vodafoneCash: null, orangeCash: null },
  availableDeliveryModes: ["delivery"],
  paymentConfigMissing: false,
};

const ADDRESSES: AddressListItem[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    label: null,
    governorate: "Cairo",
    city: "Nasr City",
    streetAddress: "1 test st",
    buildingNotes: null,
    isDefault: true,
  },
];

describe("STEP 1b (OD-4 loop) — CheckoutForm routes a phone-NULL buyer to /auth/phone", () => {
  it("submit → createOrderFromInquiry resolves phone_required → router.push('/auth/phone')", async () => {
    createOrderFromInquiryMock.mockResolvedValue({ ok: false, reason: "phone_required" });

    const { getByRole } = render(
      React.createElement(CheckoutForm, { context: CONTEXT, initialAddresses: ADDRESSES, locale: "ar" }),
    );

    fireEvent.click(getByRole("button", { name: "submit" }));

    await waitFor(() => expect(createOrderFromInquiryMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/phone"));
  });

  it("control: an ok:true outcome routes to the order confirmation page, NEVER /auth/phone", async () => {
    createOrderFromInquiryMock.mockResolvedValue({ ok: true, orderId: "order-1" });

    const { getByRole } = render(
      React.createElement(CheckoutForm, { context: CONTEXT, initialAddresses: ADDRESSES, locale: "ar" }),
    );

    fireEvent.click(getByRole("button", { name: "submit" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalledWith("/auth/phone");
    expect(pushMock.mock.calls[0]?.[0]).toContain("order-1");
  });
});
