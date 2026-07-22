/**
 * Feature: messaging (inquiries + inquiry_messages threads) — Phase 06.
 * FR IDs:  FR-BUY-5 (Buyer Inbox), FR-SEL-13 (Seller Inbox)
 * UI Spec: §4.5 Buyer Inbox, §5.13 Seller Inbox
 * Tables:  betk.inquiries, betk.inquiry_messages, betk.listings, betk.stores,
 *          betk.seller_profiles (avg_response_hours)
 * Model:   thread reads/writes under the cookie client (RLS inq_buyer /
 *          inq_insert / inq_update + inq_msg_select / inq_msg_insert /
 *          inq_msg_update [T01 REG-41] + a server-verified participation pin).
 *          NO service-role. (ADR-014 single-table create; DECISION 3 REVISED —
 *          REG-42 unread CLOSED by T02-FIX: receiver-writable is_read via the
 *          authorized ERD §3 row-52 amendment + migration 20260722124510
 *          [receiver policy + column-level is_read GRANT]; DECISION 4 REG-43
 *          last_message_at DERIVE-AT-READ). `requireActiveUser` gates (NOT
 *          requireVerifiedPhone — inquiries are pre-transaction).
 *
 * CONFIRM→CHECKOUT CONTRACT (T01-pinned): confirmInquiry writes
 * status='confirmed' (the checkout-enablement state Phase 07 gates on);
 * converted_to_order_id is NEVER written in Phase 06 (Phase-07 checkout owns it).
 *
 * IMPORTANT: Server Actions are re-exported here for typed consumption, but the
 * T03/T04 client composers MUST import each action by FILE PATH
 * (`@/features/messaging/actions/<name>`), never this barrel (it re-exports the
 * `next/headers`-backed queries — the T03/T04-Phase-05 barrel-leak precedent).
 */

// ── Read layer (queries) ────────────────────────────────────────────────────
export { getOwnInquiries } from "./queries/getOwnInquiries";
export { getInquiryThread } from "./queries/getInquiryThread";
export { getStoreInquiries } from "./queries/getStoreInquiries";

// ── Write layer (Server Actions) ────────────────────────────────────────────
export { createInquiry } from "./actions/createInquiry";
export { sendInquiryMessage } from "./actions/sendInquiryMessage";
export { confirmInquiry } from "./actions/confirmInquiry";
export { declineInquiry } from "./actions/declineInquiry";
export { markInquiryRead } from "./actions/markInquiryRead";

// ── Pure rules (unit-tested) ────────────────────────────────────────────────
export {
  resolveParticipant,
  latestActivityAt,
  lastMessagePreview,
  computeAvgResponseHours,
  type Participant,
} from "./messagingRules";

// ── Return shapes ───────────────────────────────────────────────────────────
export type {
  InquirySummary,
  InquiryThread,
  InquiryMessage,
  InquiryListingContext,
  InquiryStoreContext,
} from "./types";

// ── Schemas + discriminated result types ────────────────────────────────────
export {
  createInquirySchema,
  sendInquiryMessageSchema,
  inquiryIdInputSchema,
  inquiryStatusFilterSchema,
  getStoreInquiriesParamsSchema,
  deliveryPreferenceSchema,
} from "@/validations/messaging";
export type {
  CreateInquiryInput,
  SendInquiryMessageInput,
  InquiryIdInput,
  InquiryStatusFilter,
  GetStoreInquiriesParams,
  CreateInquiryResult,
  SendInquiryMessageResult,
  ConfirmInquiryResult,
  DeclineInquiryResult,
  MarkInquiryReadResult,
  DeliveryPreference,
} from "@/validations/messaging";
