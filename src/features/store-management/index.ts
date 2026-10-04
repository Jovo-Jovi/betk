/**
 * Feature: store-management
 * FR IDs:  FR-SEL-4 (store profile), FR-SEL-5 (delivery settings), FR-SEL-6 (return policy), FR-SEL-7 (payment methods)
 * UI Spec: §5.4–5.7 Store management — store/delivery/returns/payments
 * Tables:  betk.stores, betk.seller_profiles, betk.store_pickup_addresses
 * JSONB:   stores.payment_methods (StorePaymentMethods). P27 does not write delivery_options.
 */

export { getOwnStore } from "./queries/getOwnStore";
export type { OwnStore, StoreManagementClient } from "./queries/getOwnStore";
export { updateStoreProfile } from "./actions/updateStoreProfile";

// P27 — pickup address. P29 payments and the returns page stay.
export { getOwnStorePickup } from "./queries/getOwnStorePickup";
export type { OwnStorePickup } from "./queries/getOwnStorePickup";
export { getOwnStoreReturns } from "./queries/getOwnStoreReturns";
export type { OwnStoreReturns } from "./queries/getOwnStoreReturns";
export { getOwnStorePayments } from "./queries/getOwnStorePayments";
export type { OwnStorePayments } from "./queries/getOwnStorePayments";
export { updateStorePickup } from "./actions/updateStorePickup";
export { updateStoreReturns } from "./actions/updateStoreReturns";
export { updateStorePayments } from "./actions/updateStorePayments";
