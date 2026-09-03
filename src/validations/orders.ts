/**
 * Orders write-layer + query schemas (Zod) — Phase 07 / T02b (REG-49, ADR-019).
 *
 * Every `src/features/orders` Server Action validates its input against one of
 * these BEFORE any DB call (CI `check-zod-coverage`). The order/payment TRANSITION
 * legality is enforced authoritatively by the DB triggers (enforce_order_transition
 * / enforce_payment_update, migration 20260723140552); these schemas only shape +
 * the actions add UX-level pre-checks.
 *
 * Result types live here (not in the `"use server"` files) so each action + its
 * T04/T05/T06 client consumer share the discriminated union.
 */

import { z } from "zod";

/** cancelOrder / acceptOrder / markOrderPreparing — order-id-only inputs. */
export const orderIdInputSchema = z.object({ orderId: z.string().uuid() });
export type OrderIdInput = z.input<typeof orderIdInputSchema>;

/** confirmDepositPayment — payment-id-only input (admin). */
export const paymentIdInputSchema = z.object({ paymentId: z.string().uuid() });
export type PaymentIdInput = z.input<typeof paymentIdInputSchema>;

/* ── Query params ──────────────────────────────────────────────────────────
 * Buyer /orders + seller /seller/orders status filter tabs (T04/T06) + "all".
 */
export const orderStatusFilterSchema = z.enum([
  "all",
  "pending",
  "confirmed",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
]);
export type OrderStatusFilter = z.infer<typeof orderStatusFilterSchema>;

/* ── Discriminated results ─────────────────────────────────────────────────
 * Shared reasons: unauthenticated → /auth/login · blocked → /blocked (R-A05) ·
 * invalid → Zod · not_found → not the caller's row / doesn't exist · error.
 */
type BaseFailReason = "unauthenticated" | "blocked" | "invalid" | "not_found" | "error";

/**
 * cancelOrder — BUYER cancels their OWN order, pending only (R-O03).
 * `cancelled_by` is server-stamped by the trigger (F1); the client never supplies it.
 */
export type CancelOrderResult =
  | { ok: true }
  | { ok: false; reason: BaseFailReason | "not_cancellable" };

/**
 * confirmDepositPayment — ADMIN confirms a pending deposit payment.
 * Idempotent: already-confirmed → `{ ok: true, alreadyConfirmed: true }`.
 *   forbidden     → the caller is not an admin
 *   invalid_state → the row is not a pending deposit (balance / failed / refunded)
 */
export type ConfirmDepositPaymentResult =
  | { ok: true; alreadyConfirmed: boolean }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "invalid" | "not_found" | "invalid_state" | "error";
    };

/**
 * acceptOrder — SELLER accepts (pending→confirmed) their OWN store's order.
 * AC-SEL-14 custodial gate: the deposit must be admin-confirmed first (the DB
 * trigger is authoritative; `deposit_unconfirmed` mirrors it for UX).
 * Idempotent: already-confirmed → `{ ok: true, alreadyConfirmed: true }`.
 *   out_of_stock  → decrement_stock_on_confirm hit CHECK(stock_qty>=0); whole
 *                   accept rolled back (no partial confirm).
 *   invalid_state → the order is not pending (and not already confirmed).
 */
export type AcceptOrderResult =
  | { ok: true; alreadyConfirmed: boolean }
  | {
      ok: false;
      reason: BaseFailReason | "deposit_unconfirmed" | "out_of_stock" | "invalid_state";
    };

/**
 * markOrderPreparing — SELLER moves confirmed→preparing on their OWN store's order.
 * Idempotent: already-preparing → `{ ok: true, alreadyPreparing: true }`.
 */
export type MarkOrderPreparingResult =
  | { ok: true; alreadyPreparing: boolean }
  | { ok: false; reason: BaseFailReason | "invalid_state" };
