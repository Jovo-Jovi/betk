/**
 * Feature: checkout (confirmed-inquiry → order conversion + deposit proof) — Phase 07.
 * FR IDs:  AC-BUY-6 (create order from confirmed inquiry), OD-8 §5 (deposit proof)
 * UI Spec: §4 Checkout, §4 Confirmation
 * Tables:  betk.orders, betk.order_items, betk.payments, betk.order_status_history,
 *          betk.inquiries, betk.listings, betk.stores, betk.admin_settings, betk.addresses
 * Model:   checkout is ONE atomic SECURITY INVOKER rpc (ADR-018,
 *          create_order_from_inquiry); the write layer is REG-49 three-layer
 *          (ADR-019); amounts are SERVER-AUTHORITATIVE (rpc re-resolves them).
 *          requireVerifiedPhone gates order-create (OD-4). NO service-role.
 *
 * IMPORTANT: Server Actions are re-exported here for typed consumption, but the T03
 * client composers MUST import each action by FILE PATH
 * (`@/features/checkout/actions/<name>`), never this barrel (it re-exports the
 * `next/headers`-backed queries — the barrel-leak precedent).
 */

// ── Read layer (queries) ────────────────────────────────────────────────────
export { getCheckoutContext } from "./queries/getCheckoutContext";

// ── Write layer (Server Actions) ────────────────────────────────────────────
export { createOrderFromInquiry } from "./actions/createOrderFromInquiry";
export { attachDepositProof } from "./actions/attachDepositProof";

// ── Pure rules (unit-tested) ────────────────────────────────────────────────
export {
  round2,
  computeCheckoutAmounts,
  computeCommissionAmount,
  parseSettingNumber,
  hasAnyDepositHandle,
  isDepositHandleConfigured,
  formatBetkRef,
  isValidBetkRef,
  BETK_REF_PATTERN,
  SETTINGS_FEE_KEY,
  SETTINGS_HANDLE_KEYS,
  HANDLE_KEY_BY_METHOD,
  type CheckoutAmounts,
} from "./checkoutRules";

// ── Return shapes ───────────────────────────────────────────────────────────
export type { CheckoutContext, CheckoutDepositHandles, CheckoutListing } from "./types";

// ── Schemas + discriminated result types ────────────────────────────────────
export {
  createOrderFromInquirySchema,
  attachDepositProofSchema,
  deliveryMethodSchema,
  depositMethodSchema,
} from "@/validations/checkout";
export type {
  CreateOrderFromInquiryInput,
  CreateOrderFromInquiryResult,
  AttachDepositProofInput,
  AttachDepositProofResult,
  DeliveryMethodInput,
  DepositMethodInput,
} from "@/validations/checkout";
