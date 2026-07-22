/**
 * Messaging pure rules — Phase 06 / T02. Unit tests (no DB) for participation
 * classification, the REG-43 derive-at-read sort key, the thread preview, and
 * the DECISION-2 avg_response_hours formula — see
 * `src/features/messaging/messagingRules.ts`. Also covers the messaging Zod
 * schemas (create/send/id/status filter) in `@/validations/messaging`.
 */

import { describe, expect, it } from "vitest";
import {
  resolveParticipant,
  latestActivityAt,
  lastMessagePreview,
  computeAvgResponseHours,
} from "@/features/messaging/messagingRules";
import {
  createInquirySchema,
  sendInquiryMessageSchema,
  inquiryIdInputSchema,
  getStoreInquiriesParamsSchema,
} from "@/validations/messaging";

const BUYER = "11111111-1111-1111-1111-111111111111";
const SELLER_USER = "22222222-2222-2222-2222-222222222222";
const STORE = "33333333-3333-3333-3333-333333333333";
const OUTSIDER = "44444444-4444-4444-4444-444444444444";
const OTHER_STORE = "55555555-5555-5555-5555-555555555555";
const LISTING = "66666666-6666-6666-6666-666666666666";

describe("resolveParticipant", () => {
  const inquiry = { buyerId: BUYER, storeId: STORE };

  it("classifies the inquiry's buyer as 'buyer'", () => {
    expect(resolveParticipant(inquiry, { userId: BUYER, storeId: null })).toBe("buyer");
  });

  it("classifies the owning store's seller as 'seller'", () => {
    expect(resolveParticipant(inquiry, { userId: SELLER_USER, storeId: STORE })).toBe("seller");
  });

  it("returns null for an outsider (neither buyer nor owning store)", () => {
    expect(resolveParticipant(inquiry, { userId: OUTSIDER, storeId: OTHER_STORE })).toBeNull();
    expect(resolveParticipant(inquiry, { userId: OUTSIDER, storeId: null })).toBeNull();
  });

  it("prefers the buyer branch when the caller is both buyer and owning seller", () => {
    expect(resolveParticipant({ buyerId: BUYER, storeId: STORE }, { userId: BUYER, storeId: STORE })).toBe(
      "buyer",
    );
  });
});

describe("latestActivityAt (REG-43 derive-at-read)", () => {
  it("returns createdAt when the thread has no messages", () => {
    expect(latestActivityAt("2026-07-22T10:00:00.000Z", [])).toBe("2026-07-22T10:00:00.000Z");
  });

  it("returns the newest message sentAt when later than createdAt", () => {
    expect(
      latestActivityAt("2026-07-22T10:00:00.000Z", [
        "2026-07-22T11:00:00.000Z",
        "2026-07-22T12:30:00.000Z",
        "2026-07-22T11:45:00.000Z",
      ]),
    ).toBe("2026-07-22T12:30:00.000Z");
  });

  it("a BUYER's newest message drives the sort key to the top (the REG-43 proof)", () => {
    // seller replied at 12:00, then the BUYER replied at 13:00 → 13:00 wins, so
    // this thread sorts above one whose latest activity is 12:30.
    const buyerLast = latestActivityAt("2026-07-22T10:00:00.000Z", [
      "2026-07-22T12:00:00.000Z",
      "2026-07-22T13:00:00.000Z",
    ]);
    const otherThread = latestActivityAt("2026-07-22T09:00:00.000Z", ["2026-07-22T12:30:00.000Z"]);
    expect(Date.parse(buyerLast)).toBeGreaterThan(Date.parse(otherThread));
  });
});

describe("lastMessagePreview", () => {
  it("uses the buyer's opening message when the thread is empty (ADR-014)", () => {
    expect(lastMessagePreview("hello there", [])).toBe("hello there");
  });

  it("uses the most recent message body otherwise", () => {
    expect(
      lastMessagePreview("opening", [
        { body: "reply one", sentAt: "2026-07-22T11:00:00.000Z" },
        { body: "latest reply", sentAt: "2026-07-22T12:00:00.000Z" },
      ]),
    ).toBe("latest reply");
  });
});

describe("computeAvgResponseHours (DECISION 2 / Option A)", () => {
  it("returns null with no responded inquiries", () => {
    expect(computeAvgResponseHours([])).toBeNull();
  });

  it("averages (firstSellerReply − created) in hours, rounded to 2dp", () => {
    const avg = computeAvgResponseHours([
      // 2h and 4h → mean 3.00
      { inquiryCreatedAt: "2026-07-22T10:00:00.000Z", firstSellerReplyAt: "2026-07-22T12:00:00.000Z" },
      { inquiryCreatedAt: "2026-07-22T10:00:00.000Z", firstSellerReplyAt: "2026-07-22T14:00:00.000Z" },
    ]);
    expect(avg).toBe(3);
  });

  it("rounds to NUMERIC(5,2) precision", () => {
    const avg = computeAvgResponseHours([
      // 1h30m = 1.5, 1h = 1.0 → mean 1.25
      { inquiryCreatedAt: "2026-07-22T10:00:00.000Z", firstSellerReplyAt: "2026-07-22T11:30:00.000Z" },
      { inquiryCreatedAt: "2026-07-22T10:00:00.000Z", firstSellerReplyAt: "2026-07-22T11:00:00.000Z" },
    ]);
    expect(avg).toBe(1.25);
  });

  it("ignores negative/NaN deltas (clock skew / bad rows)", () => {
    const avg = computeAvgResponseHours([
      { inquiryCreatedAt: "2026-07-22T12:00:00.000Z", firstSellerReplyAt: "2026-07-22T10:00:00.000Z" }, // negative
      { inquiryCreatedAt: "2026-07-22T10:00:00.000Z", firstSellerReplyAt: "2026-07-22T13:00:00.000Z" }, // 3h
    ]);
    expect(avg).toBe(3);
  });

  it("caps at the column max 999.99", () => {
    const avg = computeAvgResponseHours([
      { inquiryCreatedAt: "2020-01-01T00:00:00.000Z", firstSellerReplyAt: "2030-01-01T00:00:00.000Z" },
    ]);
    expect(avg).toBe(999.99);
  });
});

describe("messaging Zod schemas", () => {
  it("createInquirySchema requires a listing uuid + non-empty message; extras optional", () => {
    expect(createInquirySchema.safeParse({ listingId: LISTING, message: "hi" }).success).toBe(true);
    expect(
      createInquirySchema.safeParse({
        listingId: LISTING,
        message: "hi",
        quantity: 2,
        deliveryPreference: "pickup",
        specialRequests: "gift wrap",
      }).success,
    ).toBe(true);
    expect(createInquirySchema.safeParse({ listingId: LISTING, message: "" }).success).toBe(false);
    expect(createInquirySchema.safeParse({ listingId: "not-a-uuid", message: "hi" }).success).toBe(
      false,
    );
    expect(
      createInquirySchema.safeParse({ listingId: LISTING, message: "hi", quantity: 0 }).success,
    ).toBe(false);
  });

  it("sendInquiryMessageSchema requires inquiry uuid + non-empty body", () => {
    expect(sendInquiryMessageSchema.safeParse({ inquiryId: LISTING, body: "yo" }).success).toBe(true);
    expect(sendInquiryMessageSchema.safeParse({ inquiryId: LISTING, body: "" }).success).toBe(false);
  });

  it("inquiryIdInputSchema requires a uuid", () => {
    expect(inquiryIdInputSchema.safeParse({ inquiryId: LISTING }).success).toBe(true);
    expect(inquiryIdInputSchema.safeParse({ inquiryId: "x" }).success).toBe(false);
  });

  it("getStoreInquiriesParamsSchema defaults status to 'all'", () => {
    const parsed = getStoreInquiriesParamsSchema.parse({});
    expect(parsed.status).toBe("all");
    expect(getStoreInquiriesParamsSchema.safeParse({ status: "confirmed" }).success).toBe(true);
    expect(getStoreInquiriesParamsSchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});
