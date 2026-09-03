/**
 * Checkout view-model types — Phase 07 / T02b. Consumed by getCheckoutContext +
 * the T03 /checkout composer. Commission is DELIBERATELY absent (it is a
 * BETK↔seller concern; the buyer never sees the rate or amount).
 */

import type { InquiryStatus } from "@/constants/enums";
import type { CheckoutAmounts } from "./checkoutRules";
import type { DeliveryMethodInput } from "@/validations/checkout";

/** The BETK custodial deposit handles (from admin_settings, NOT the store's own). */
export interface CheckoutDepositHandles {
  instapay: string | null;
  vodafoneCash: string | null;
  orangeCash: string | null;
}

/** The listing line the confirmed inquiry converts into a single order item. */
export interface CheckoutListing {
  id: string;
  titleAr: string;
  titleEn: string | null;
  unitPrice: number;
}

/**
 * Everything the /checkout screen needs to render the summary + deposit picker
 * WITHOUT the client ever computing money (the amounts here mirror what the rpc
 * will commit) or seeing a secret. Null-listing / non-confirmed states are still
 * returned so the page can route per spec.
 */
export interface CheckoutContext {
  inquiryId: string;
  status: InquiryStatus;
  convertedToOrderId: string | null;
  storeId: string;
  listing: CheckoutListing | null;
  quantity: number;
  amounts: CheckoutAmounts;
  handles: CheckoutDepositHandles;
  /** REG-14: the store's enabled delivery modes (the picker offers only these). */
  availableDeliveryModes: DeliveryMethodInput[];
  /** True when ZERO BETK deposit handles are configured (disable submit, T03). */
  paymentConfigMissing: boolean;
}
