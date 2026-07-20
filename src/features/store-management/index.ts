/**
 * Feature: store-management
 * FR IDs:  FR-SEL-4 (store profile), FR-SEL-5 (delivery settings), FR-SEL-6 (return policy), FR-SEL-7 (payment methods)
 * UI Spec: §5.4–5.7 Store management — store/delivery/returns/payments
 * Tables:  betk.stores, betk.seller_profiles
 * JSONB:   stores.delivery_options (StoreDeliveryOptions), stores.payment_methods (StorePaymentMethods)
 */

export { getOwnStore } from "./queries/getOwnStore";
export type { OwnStore, StoreManagementClient } from "./queries/getOwnStore";
export { updateStoreProfile } from "./actions/updateStoreProfile";

// T07 — delivery / returns / payments settings.
export { getOwnStoreDelivery } from "./queries/getOwnStoreDelivery";
export type { OwnStoreDelivery } from "./queries/getOwnStoreDelivery";
export { getOwnStoreReturns } from "./queries/getOwnStoreReturns";
export type { OwnStoreReturns } from "./queries/getOwnStoreReturns";
export { getOwnStorePayments } from "./queries/getOwnStorePayments";
export type { OwnStorePayments } from "./queries/getOwnStorePayments";
export { updateStoreDelivery } from "./actions/updateStoreDelivery";
export { updateStoreReturns } from "./actions/updateStoreReturns";
export { updateStorePayments } from "./actions/updateStorePayments";
