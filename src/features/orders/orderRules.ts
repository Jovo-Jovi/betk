/**
 * Pure order/payment transition rules — Phase 07 / T02b. NO DB, NO IO; unit-tested.
 *
 * These mirror the LEGALITY the DB triggers enforce authoritatively
 * (enforce_order_transition / enforce_payment_update, migration 20260723140552).
 * The triggers are the authority (they RAISE); these predicates power the actions'
 * UX-level pre-checks and are unit-tested so the JS view of "what's legal" cannot
 * drift from the SQL. Phase-08 transitions (dispatched/delivered/returned) are NOT
 * admitted in Phase 07 — they are absent here on purpose.
 */

import type { OrderStatus, PaymentStatus } from "@/constants/enums";

/** Buyer may cancel ONLY from pending (R-O03). */
export function isBuyerCancellable(status: OrderStatus): boolean {
  return status === "pending";
}

/** Seller may accept (pending→confirmed) ONLY from pending. */
export function isAcceptable(status: OrderStatus): boolean {
  return status === "pending";
}

/** Seller may mark preparing ONLY from confirmed. */
export function isPreparable(status: OrderStatus): boolean {
  return status === "confirmed";
}

/**
 * The seller's accept is additionally gated on the deposit being admin-confirmed
 * (AC-SEL-14 custodial gate). The DB trigger re-checks this authoritatively.
 */
export function canAccept(status: OrderStatus, depositConfirmed: boolean): boolean {
  return isAcceptable(status) && depositConfirmed;
}

/**
 * The ONLY legal order status changes a Phase-07 actor may drive (matches
 * enforce_order_transition). Used by the unit test as the legality table.
 */
export const LEGAL_ORDER_TRANSITIONS: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
  ["pending", "confirmed"], // seller accept
  ["confirmed", "preparing"], // seller preparing
  ["pending", "cancelled"], // buyer cancel
];

/** True when (from → to) is one of the Phase-07 legal order transitions. */
export function isLegalOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_ORDER_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/**
 * The ONLY legal payment status change (F2) is pending→confirmed. refunded/failed
 * belong to Phase 10/14 and are rejected by enforce_payment_update.
 */
export function isLegalPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === "pending" && to === "confirmed";
}
