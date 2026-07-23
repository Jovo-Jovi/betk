/**
 * Orders view-model types — Phase 07 / T02b. Consumed by the buyer (T04), admin
 * (T05) and seller (T06) order surfaces.
 *
 * REG-44 (FLAGGED, OWED): the seller surfaces need the buyer's name + delivery
 * address for fulfilment, but the live RLS (`addr_self`, `bp_self` = own/admin
 * only) does NOT let a seller read either, and no seller-read broadening / order
 * snapshot was authorized in T02b. So `buyerName` / `deliveryAddress` resolve to
 * `null` for sellers under the current schema. The fields are modelled now so
 * that when REG-44's data-access mechanism lands (an authorized seller-read policy
 * or an order-level snapshot), the same queries surface it with no shape change.
 * DO NOT invent that broadening here — it is a human-authorized decision.
 */

import type {
  OrderStatus,
  PaymentStatus,
  PaymentType,
  PaymentMethod,
  CancelledByType,
  DeliveryPreference,
} from "@/constants/enums";

export interface OrderPaymentView {
  id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  proofPath: string | null;
  transferReference: string | null;
  confirmedAt: string | null;
}

export interface OrderItemView {
  id: string;
  listingId: string;
  titleAr: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderTimelineEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByType: CancelledByType;
  notes: string | null;
  createdAt: string;
}

/** REG-44 — null for sellers under current RLS (see file header). */
export interface OrderAddressView {
  label: string | null;
  streetAddress: string;
  city: string;
  governorate: string;
  buildingNotes: string | null;
}

export interface OrderListingRef {
  titleAr: string;
  titleEn: string | null;
  heroImageUrl: string | null;
}

export interface OrderStoreRef {
  id: string;
  nameAr: string;
  nameEn: string | null;
  slug: string;
}

export interface OrderSummary {
  id: string;
  betkRef: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  listing: OrderListingRef | null;
  store: OrderStoreRef | null;
  /** The deposit payment's status — powers the seller queue + accept gate. */
  depositStatus: PaymentStatus | null;
  /** REG-44 — the buyer's display name (null for sellers under current RLS). */
  buyerName: string | null;
}

export interface OrderDetail extends OrderSummary {
  subtotal: number;
  deliveryFee: number;
  deliveryMethod: DeliveryPreference;
  cancellationReason: string | null;
  cancelledBy: CancelledByType | null;
  confirmedAt: string | null;
  items: OrderItemView[];
  payments: OrderPaymentView[];
  timeline: OrderTimelineEntry[];
  /** REG-44 — the delivery address (null for sellers under current RLS). */
  deliveryAddress: OrderAddressView | null;
}

/** Admin deposit-verification queue row (T05). */
export interface PendingDepositPayment {
  paymentId: string;
  orderId: string;
  betkRef: string;
  amount: number;
  proofPath: string | null;
  transferReference: string | null;
  submittedAt: string;
  /** proof_path NOT NULL → actionable (awaiting BETK verification) vs awaiting upload. */
  hasProof: boolean;
  store: OrderStoreRef | null;
  /** REG-44 — null under current RLS (admin CAN read via is_admin(), see query). */
  buyerName: string | null;
}
