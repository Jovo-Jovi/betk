/**
 * Checkout + order pure rules — Phase 07 / T02b. Unit tests (no DB) for the
 * SERVER-AUTHORITATIVE arithmetic mirrored in JS (split amounts, commission
 * rounding, BETK-ref format) and the DB-authoritative transition legality table —
 * see `src/features/checkout/checkoutRules.ts` + `src/features/orders/orderRules.ts`.
 * Also covers the checkout/orders Zod schemas.
 *
 * These lock the JS preview to the SQL truth: `computeCheckoutAmounts` must match
 * the rpc (subtotal = price×qty, total = subtotal + fee, deposit = round(total/2),
 * balance = total − deposit); `computeCommissionAmount` must match
 * set_order_commission_snapshot (round(rate/100 × subtotal, 2)); the transition
 * predicates must match enforce_order_transition / enforce_payment_update.
 */

import { describe, expect, it } from "vitest";
import {
  round2,
  computeCheckoutAmounts,
  computeCommissionAmount,
  parseSettingNumber,
  hasAnyDepositHandle,
  isDepositHandleConfigured,
  formatBetkRef,
  isValidBetkRef,
  SETTINGS_HANDLE_KEYS,
  HANDLE_KEY_BY_METHOD,
} from "@/features/checkout/checkoutRules";
import {
  isBuyerCancellable,
  isAcceptable,
  isPreparable,
  canAccept,
  isLegalOrderTransition,
  isLegalPaymentTransition,
} from "@/features/orders/orderRules";
import {
  createOrderFromInquirySchema,
  attachDepositProofSchema,
  depositMethodSchema,
} from "@/validations/checkout";
import { orderIdInputSchema, paymentIdInputSchema, orderStatusFilterSchema } from "@/validations/orders";
import type { OrderStatus, PaymentStatus } from "@/constants/enums";

const UUID = "11111111-1111-1111-1111-111111111111";
const UUID2 = "22222222-2222-2222-2222-222222222222";

describe("round2", () => {
  it("rounds to 2dp (piastres) like SQL round(x, 2)", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(100)).toBe(100);
    expect(round2(0)).toBe(0);
  });
});

describe("computeCheckoutAmounts (mirrors the rpc)", () => {
  it("subtotal = price×qty, total = subtotal + fee, 50/50 split", () => {
    const a = computeCheckoutAmounts(100, 2, 30);
    expect(a).toEqual({ subtotal: 200, deliveryFee: 30, total: 230, deposit: 115, balance: 115 });
  });

  it("balance absorbs the odd piastre so deposit + balance === total (chk_order_total)", () => {
    const a = computeCheckoutAmounts(33.33, 3, 0); // subtotal 99.99 → deposit 50.00, balance 49.99
    expect(a.subtotal).toBe(99.99);
    expect(a.total).toBe(99.99);
    expect(round2(a.deposit + a.balance)).toBe(a.total);
    expect(a.deposit).toBe(50);
    expect(a.balance).toBe(49.99);
  });

  it("zero fee → total equals subtotal", () => {
    const a = computeCheckoutAmounts(250, 1, 0);
    expect(a.total).toBe(250);
    expect(a.deliveryFee).toBe(0);
  });
});

describe("computeCommissionAmount (base = subtotal, NEVER total)", () => {
  it("round(rate/100 × subtotal, 2)", () => {
    expect(computeCommissionAmount(10, 200)).toBe(20);
    expect(computeCommissionAmount(2.5, 99.99)).toBe(2.5); // 2.49975 → 2.50
    expect(computeCommissionAmount(0, 500)).toBe(0);
  });
});

describe("parseSettingNumber (NULLIF/COALESCE parity)", () => {
  it("null/undefined/'' → 0; numeric strings parse; junk → 0", () => {
    expect(parseSettingNumber(null)).toBe(0);
    expect(parseSettingNumber(undefined)).toBe(0);
    expect(parseSettingNumber("")).toBe(0);
    expect(parseSettingNumber("  ")).toBe(0);
    expect(parseSettingNumber("30")).toBe(30);
    expect(parseSettingNumber("12.50")).toBe(12.5);
    expect(parseSettingNumber("abc")).toBe(0);
  });
});

describe("deposit-handle configuration", () => {
  const [instapayKey, vodaKey, orangeKey] = SETTINGS_HANDLE_KEYS;

  it("hasAnyDepositHandle is false when all three are empty/absent, true otherwise", () => {
    expect(hasAnyDepositHandle({})).toBe(false);
    expect(hasAnyDepositHandle({ [instapayKey]: "", [vodaKey]: "  ", [orangeKey]: null })).toBe(false);
    expect(hasAnyDepositHandle({ [vodaKey]: "01000000000" })).toBe(true);
  });

  it("isDepositHandleConfigured checks the SPECIFIC chosen rail", () => {
    const handles = { [HANDLE_KEY_BY_METHOD.instapay]: "user@instapay" };
    expect(isDepositHandleConfigured("instapay", handles)).toBe(true);
    expect(isDepositHandleConfigured("vodafone_cash", handles)).toBe(false);
    expect(isDepositHandleConfigured("orange_cash", handles)).toBe(false);
  });
});

describe("betk_ref format (R-O02, BETK-YYYYMMDD-XXXX)", () => {
  it("formatBetkRef builds a UTC-dated, 4-upper-hex ref", () => {
    const ref = formatBetkRef(new Date("2026-07-23T23:30:00.000Z"), "abcd");
    expect(ref).toBe("BETK-20260723-ABCD");
    expect(isValidBetkRef(ref)).toBe(true);
  });

  it("isValidBetkRef rejects malformed refs", () => {
    expect(isValidBetkRef("BETK-20260723-ABCD")).toBe(true);
    expect(isValidBetkRef("BETK-2026072-ABCD")).toBe(false); // 7-digit date
    expect(isValidBetkRef("BETK-20260723-abcd")).toBe(false); // lowercase
    expect(isValidBetkRef("BETK-20260723-ABCDE")).toBe(false); // 5 chars
    expect(isValidBetkRef("betk-20260723-ABCD")).toBe(false); // prefix case
    expect(isValidBetkRef("20260723-ABCD")).toBe(false);
  });
});

describe("order transition predicates (mirror enforce_order_transition)", () => {
  const ALL: OrderStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "dispatched",
    "delivered",
    "cancelled",
    "returned",
  ];

  it("buyer cancellable ONLY from pending (R-O03)", () => {
    for (const s of ALL) expect(isBuyerCancellable(s)).toBe(s === "pending");
  });

  it("acceptable ONLY from pending; preparable ONLY from confirmed", () => {
    for (const s of ALL) expect(isAcceptable(s)).toBe(s === "pending");
    for (const s of ALL) expect(isPreparable(s)).toBe(s === "confirmed");
  });

  it("canAccept requires pending AND a confirmed deposit (AC-SEL-14)", () => {
    expect(canAccept("pending", true)).toBe(true);
    expect(canAccept("pending", false)).toBe(false);
    expect(canAccept("confirmed", true)).toBe(false);
  });

  it("isLegalOrderTransition admits exactly the 3 Phase-07 edges", () => {
    expect(isLegalOrderTransition("pending", "confirmed")).toBe(true);
    expect(isLegalOrderTransition("confirmed", "preparing")).toBe(true);
    expect(isLegalOrderTransition("pending", "cancelled")).toBe(true);
    // Phase-08 + illegal edges are rejected
    expect(isLegalOrderTransition("confirmed", "dispatched")).toBe(false);
    expect(isLegalOrderTransition("confirmed", "cancelled")).toBe(false);
    expect(isLegalOrderTransition("preparing", "delivered")).toBe(false);
    expect(isLegalOrderTransition("pending", "preparing")).toBe(false);
  });
});

describe("payment transition (F2 — mirror enforce_payment_update)", () => {
  const ALL: PaymentStatus[] = ["pending", "confirmed", "failed", "refunded"];

  it("admits ONLY pending→confirmed", () => {
    expect(isLegalPaymentTransition("pending", "confirmed")).toBe(true);
    for (const from of ALL)
      for (const to of ALL) {
        if (from === "pending" && to === "confirmed") continue;
        expect(isLegalPaymentTransition(from, to)).toBe(false);
      }
  });
});

describe("checkout Zod schemas", () => {
  it("createOrderFromInquirySchema requires 4 uuid/enum fields; NO amount/fee field", () => {
    expect(
      createOrderFromInquirySchema.safeParse({
        inquiryId: UUID,
        addressId: UUID2,
        deliveryMethod: "delivery",
        depositMethod: "instapay",
      }).success,
    ).toBe(true);
    // cod is NOT a valid deposit rail (custodial electronic only)
    expect(
      createOrderFromInquirySchema.safeParse({
        inquiryId: UUID,
        addressId: UUID2,
        deliveryMethod: "delivery",
        depositMethod: "cod",
      }).success,
    ).toBe(false);
    expect(
      createOrderFromInquirySchema.safeParse({
        inquiryId: "nope",
        addressId: UUID2,
        deliveryMethod: "delivery",
        depositMethod: "instapay",
      }).success,
    ).toBe(false);
  });

  it("depositMethodSchema excludes cod, admits the 3 electronic rails", () => {
    expect(depositMethodSchema.safeParse("instapay").success).toBe(true);
    expect(depositMethodSchema.safeParse("vodafone_cash").success).toBe(true);
    expect(depositMethodSchema.safeParse("orange_cash").success).toBe(true);
    expect(depositMethodSchema.safeParse("cod").success).toBe(false);
  });

  it("attachDepositProofSchema requires order uuid + non-empty path; reference optional", () => {
    expect(attachDepositProofSchema.safeParse({ orderId: UUID, storagePath: "u/x.jpg" }).success).toBe(
      true,
    );
    expect(
      attachDepositProofSchema.safeParse({
        orderId: UUID,
        storagePath: "u/x.jpg",
        transferReference: "REF123",
      }).success,
    ).toBe(true);
    expect(attachDepositProofSchema.safeParse({ orderId: UUID, storagePath: "" }).success).toBe(false);
    expect(attachDepositProofSchema.safeParse({ orderId: "x", storagePath: "u/x.jpg" }).success).toBe(
      false,
    );
  });
});

describe("orders Zod schemas", () => {
  it("orderIdInputSchema / paymentIdInputSchema require a uuid", () => {
    expect(orderIdInputSchema.safeParse({ orderId: UUID }).success).toBe(true);
    expect(orderIdInputSchema.safeParse({ orderId: "x" }).success).toBe(false);
    expect(paymentIdInputSchema.safeParse({ paymentId: UUID }).success).toBe(true);
    expect(paymentIdInputSchema.safeParse({ paymentId: "x" }).success).toBe(false);
  });

  it("orderStatusFilterSchema admits 'all' + every order_status, rejects junk", () => {
    for (const s of ["all", "pending", "confirmed", "preparing", "dispatched", "delivered", "cancelled", "returned"]) {
      expect(orderStatusFilterSchema.safeParse(s).success).toBe(true);
    }
    expect(orderStatusFilterSchema.safeParse("bogus").success).toBe(false);
  });
});
