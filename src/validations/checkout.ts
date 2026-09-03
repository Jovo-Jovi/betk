/**
 * Checkout write-layer schemas (Zod) — Phase 07 / T02b (AC-BUY-6, REG-49, ADR-018).
 *
 * Every `src/features/checkout` Server Action validates its input against one of
 * these BEFORE any DB call / rpc (CI `check-zod-coverage`). Shapes mirror the
 * `create_order_from_inquiry` rpc signature (migration 20260723140552) and the
 * T01-pinned ORDER-SET CONTRACT:
 *   • deposit leg → a BETK electronic rail only (instapay|vodafone_cash|orange_cash);
 *     cod is the BALANCE leg, never the deposit (the rpc RAISEs otherwise).
 *   • delivery_method → betk.delivery_preference {delivery, pickup, remote}.
 *   • amounts are SERVER-AUTHORITATIVE — the client NEVER supplies price/fee/total.
 *
 * Result types live here (not in the `"use server"` files, which may only export
 * async functions) so each action and its T03 client consumer share the union.
 */

import { z } from "zod";

/** betk.delivery_preference (schema L54) — the 3 live modes (REG-14). */
export const deliveryMethodSchema = z.enum(["delivery", "pickup", "remote"]);
export type DeliveryMethodInput = z.infer<typeof deliveryMethodSchema>;

/**
 * The deposit rail. cod is DELIBERATELY excluded — a deposit must go to a BETK
 * electronic handle (custodial, OD-8/ADR-016); cod is the balance leg only.
 * (The rpc re-asserts this: BETK_INVALID_DEPOSIT_METHOD.)
 */
export const depositMethodSchema = z.enum(["instapay", "vodafone_cash", "orange_cash"]);
export type DepositMethodInput = z.infer<typeof depositMethodSchema>;

/**
 * createOrderFromInquiry — buyer converts a seller-confirmed inquiry into an
 * order. `delivery_fee` and all amounts are NOT inputs — the rpc re-resolves them
 * server-side (ADR-018). Only the four rpc params are accepted.
 */
export const createOrderFromInquirySchema = z.object({
  inquiryId: z.string().uuid(),
  addressId: z.string().uuid(),
  deliveryMethod: deliveryMethodSchema,
  depositMethod: depositMethodSchema,
});
export type CreateOrderFromInquiryInput = z.input<typeof createOrderFromInquirySchema>;

/**
 * attachDepositProof — buyer attaches a transfer screenshot path + optional
 * reference to their OWN order's deposit payment row. `storagePath` is the docs
 * bucket object path (re-checked server-side to be under the caller's own uid
 * prefix — the Phase-04 docs contract).
 */
export const attachDepositProofSchema = z.object({
  orderId: z.string().uuid(),
  storagePath: z.string().trim().min(1).max(1024),
  transferReference: z.string().trim().min(1).max(255).optional(),
});
export type AttachDepositProofInput = z.input<typeof attachDepositProofSchema>;

/* ── Discriminated results ─────────────────────────────────────────────────
 * Every action NEVER throws to the client — it returns one of these unions.
 * Shared reasons: unauthenticated → /auth/login · blocked → /blocked (R-A05) ·
 * invalid → Zod · error → generic.
 */

/**
 * createOrderFromInquiry outcomes (T03 routes each):
 *   ok                          → /checkout/confirmation/[orderId]
 *   phone_required              → /auth/phone (OD-4 loop)
 *   already_converted           → the existing order (idempotent; carries id)
 *   not_confirmed               → back to the inquiry thread
 *   payment_config_missing      → the disabled deposit state (CREATE NOTHING)
 *   delivery_method_unavailable → the store doesn't offer that mode (REG-14)
 *   address_not_found           → the address isn't the caller's own
 *   listing_unavailable         → the listing has no price / is gone
 *   not_found                   → the inquiry isn't the caller's / doesn't exist
 */
export type CreateOrderFromInquiryResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "already_converted"; existingOrderId: string }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "phone_required"
        | "blocked"
        | "invalid"
        | "not_found"
        | "not_confirmed"
        | "payment_config_missing"
        | "delivery_method_unavailable"
        | "address_not_found"
        | "listing_unavailable"
        | "error";
    };

/**
 * attachDepositProof outcomes:
 *   not_found   → not the caller's order, or no deposit row
 *   not_pending → the deposit is already confirmed (re-upload no longer allowed)
 */
export type AttachDepositProofResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "invalid" | "not_found" | "not_pending" | "error";
    };
