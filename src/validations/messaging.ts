/**
 * Messaging write-layer schemas (Zod) — Phase 06 / T02 (FR-BUY-5, FR-SEL-13).
 *
 * Every `src/features/messaging` Server Action validates its input against one
 * of these BEFORE any DB call (CI `check-zod-coverage`). Shapes mirror the DB
 * columns (BETK_DATABASE_SCHEMA `betk.inquiries` / `inquiry_messages`) and the
 * T01-pinned CONFIRM→CHECKOUT CONTRACT (SESSION_CONTEXT):
 *   • inquiry_status enum = {open, replied, confirmed, declined, expired};
 *     the confirm→checkout member = 'confirmed' (confirmInquiry writes it).
 *   • buyer_first_message is NOT NULL — the opening message lives on the inquiry
 *     row (ADR-014, single-table INSERT); inquiry_messages is the reply thread.
 *
 * Result types live here (not in the `"use server"` action files, which may
 * only export async functions) so each action and its T03/T04 client consumer
 * share the discriminated union.
 *
 * DB constraints that stay AUTHORITATIVE (Zod pre-validates; the DB is final):
 *   • inquiries.quantity CHECK (quantity > 0)
 *   • inquiries.buyer_first_message NOT NULL / inquiry_messages.body NOT NULL
 *   • RLS inq_insert / inq_msg_insert / inq_update (T01 REG-41) — the authz boundary.
 */

import { z } from "zod";

/** delivery_preference enum (schema L54) — the optional composer field (UI_SPEC L110). */
export const deliveryPreferenceSchema = z.enum(["delivery", "pickup", "remote"]);
export type DeliveryPreference = z.infer<typeof deliveryPreferenceSchema>;

/** Free-text message bodies (buyer_first_message / inquiry_messages.body are TEXT). */
const messageBodySchema = z.string().trim().min(1).max(2000);

/**
 * createInquiry — buyer opens an inquiry from a listing detail page.
 * `message` → inquiries.buyer_first_message (NOT NULL, the opening message,
 * ADR-014). storeId is NEVER accepted from the client — the action resolves it
 * from the listing server-side. quantity/deliveryPreference/specialRequests are
 * the optional composer extras (UI_SPEC L108-110).
 */
export const createInquirySchema = z.object({
  listingId: z.string().uuid(),
  message: messageBodySchema,
  quantity: z.number().int().positive().max(32_767).optional(),
  deliveryPreference: deliveryPreferenceSchema.optional(),
  specialRequests: z.string().trim().max(2000).optional(),
});
export type CreateInquiryInput = z.input<typeof createInquirySchema>;

/** sendInquiryMessage — either party appends a message to their thread. */
export const sendInquiryMessageSchema = z.object({
  inquiryId: z.string().uuid(),
  body: messageBodySchema,
});
export type SendInquiryMessageInput = z.input<typeof sendInquiryMessageSchema>;

/** confirmInquiry / declineInquiry — seller-only status transitions. */
export const inquiryIdInputSchema = z.object({ inquiryId: z.string().uuid() });
export type InquiryIdInput = z.input<typeof inquiryIdInputSchema>;

/* ── Query params ──────────────────────────────────────────────────────────
 * getStoreInquiries status filter (the seller-inbox tabs, T04) + "all".
 */
export const inquiryStatusFilterSchema = z.enum([
  "all",
  "open",
  "replied",
  "confirmed",
  "declined",
  "expired",
]);
export type InquiryStatusFilter = z.infer<typeof inquiryStatusFilterSchema>;

export const getStoreInquiriesParamsSchema = z.object({
  status: inquiryStatusFilterSchema.default("all"),
});
export type GetStoreInquiriesParams = z.input<typeof getStoreInquiriesParamsSchema>;

/* ── Discriminated results ─────────────────────────────────────────────────
 * Every action NEVER throws to the client — it returns one of these unions.
 * Shared reasons:
 *   unauthenticated → /auth/login · blocked → /blocked (R-A05) · invalid → Zod
 *   · not_found → the inquiry isn't the caller's (RLS/participation scope) or
 *   the target doesn't exist · error → generic.
 */
type BaseFailReason = "unauthenticated" | "blocked" | "invalid" | "not_found" | "error";

export type CreateInquiryResult =
  | { ok: true; inquiryId: string }
  | { ok: false; reason: Exclude<BaseFailReason, "not_found"> | "listing_unavailable" };

export type SendInquiryMessageResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: BaseFailReason };

/**
 * confirmInquiry — the CHECKOUT-ENABLEMENT write (status → 'confirmed').
 * Idempotent: a re-confirm of an already-confirmed inquiry returns
 * `{ ok: true, alreadyConfirmed: true }` (typed already_confirmed). A terminal
 * state (declined/expired) → invalid_state.
 */
export type ConfirmInquiryResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: BaseFailReason | "invalid_state" };

/** declineInquiry — status → 'declined' (UI_SPEC L481). Idempotent like confirm. */
export type DeclineInquiryResult =
  | { ok: true; alreadyDeclined: boolean }
  | { ok: false; reason: BaseFailReason | "invalid_state" };
