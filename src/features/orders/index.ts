/**
 * Feature: orders (buyer/seller/admin order lifecycle) — Phase 07.
 * FR IDs:  R-O03 (buyer cancel), AC-SEL-14 (custodial accept gate), OD-8 §5 (deposit confirm)
 * UI Spec: §4 Buyer Orders, §5 Seller Orders, §Admin Payments
 * Tables:  betk.orders, betk.payments, betk.order_status_history, betk.order_items,
 *          betk.stores, betk.listings, betk.addresses
 * Model:   REG-49 three-layer write authz (column GRANT + row policy + OLD-aware
 *          trigger; ADR-019). Transition legality is DB-authoritative
 *          (enforce_order_transition / enforce_payment_update, migration
 *          20260723140552). Admin gate = requireAdmin (mirrors betk.is_admin()).
 *          NO service-role.
 *
 * REG-44 (FLAGGED): seller order surfaces need the buyer's name + delivery address,
 * but `bp_self`/`addr_self` (own/admin only) give the seller no read path and T02b
 * authorized no broadening/snapshot → those fields are null for sellers. Owed.
 *
 * IMPORTANT: the T04/T05/T06 client composers MUST import each Server Action by
 * FILE PATH (`@/features/orders/actions/<name>`), never this barrel (it re-exports
 * the `next/headers`-backed queries — the barrel-leak precedent).
 */

// ── Read layer (queries) ────────────────────────────────────────────────────
export { getOwnOrders } from "./queries/getOwnOrders";
export { getOrderDetail } from "./queries/getOrderDetail";
export { getStoreOrders } from "./queries/getStoreOrders";
export { getStoreOrderDetail } from "./queries/getStoreOrderDetail";
export { getPendingDepositPayments } from "./queries/getPendingDepositPayments";

// ── Write layer (Server Actions) ────────────────────────────────────────────
export { cancelOrder } from "./actions/cancelOrder";
export { confirmDepositPayment } from "./actions/confirmDepositPayment";
export { acceptOrder } from "./actions/acceptOrder";
export { markOrderPreparing } from "./actions/markOrderPreparing";

// ── Pure rules (unit-tested) ────────────────────────────────────────────────
export {
  isBuyerCancellable,
  isAcceptable,
  isPreparable,
  canAccept,
  isLegalOrderTransition,
  isLegalPaymentTransition,
  LEGAL_ORDER_TRANSITIONS,
} from "./orderRules";

// ── Return shapes ───────────────────────────────────────────────────────────
export type {
  OrderSummary,
  OrderDetail,
  OrderItemView,
  OrderPaymentView,
  OrderTimelineEntry,
  OrderAddressView,
  OrderStoreRef,
  OrderListingRef,
  PendingDepositPayment,
} from "./types";

// ── Schemas + discriminated result types ────────────────────────────────────
export {
  orderIdInputSchema,
  paymentIdInputSchema,
  orderStatusFilterSchema,
} from "@/validations/orders";
export type {
  OrderIdInput,
  PaymentIdInput,
  OrderStatusFilter,
  CancelOrderResult,
  ConfirmDepositPaymentResult,
  AcceptOrderResult,
  MarkOrderPreparingResult,
} from "@/validations/orders";
