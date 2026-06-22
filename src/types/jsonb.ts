/**
 * Hand-written TypeScript interfaces over the generated `Json` type for
 * BETK JSONB columns. These narrow the opaque `Json` union to concrete shapes
 * so callers get type-safe access to payment_methods, delivery_options,
 * notification_prefs, and notification data payloads.
 *
 * Usage:
 *   import { getTyped, StorePaymentMethods } from "@/types/jsonb"
 *   const methods = getTyped<StorePaymentMethods>(store.payment_methods)
 *
 * Keep these in sync with the DB defaults in the migration files
 * (0003_user_seller_store.sql, 0004_catalog.sql).
 */

import type { Json } from "@/lib/supabase/types";

/* ── StorePaymentMethods ───────────────────────────────────────────────────
 * stores.payment_methods JSONB  (C3 §3, stores table)
 * Accepted payment handles/flags set by the seller on their store profile.
 */
export interface StorePaymentMethods {
  /** InstaPay registered username / phone (e.g. "01012345678") */
  instapay_handle?: string;
  /** Vodafone Cash phone number */
  vodafone_cash?: string;
  /** Orange Cash phone number */
  orange_cash?: string;
  /** Whether cash-on-delivery is accepted */
  cod_enabled?: boolean;
}

/* ── StoreDeliveryOptions ──────────────────────────────────────────────────
 * stores.delivery_options JSONB  AND  listings.delivery_options JSONB
 * Delivery configuration at store level; listings may override per-item.
 */
export interface StoreDeliveryOptions {
  /** Supported delivery modes (mirrors delivery_preference enum) */
  modes?: Array<"delivery" | "pickup" | "remote">;
  /** Minimum days to deliver (for 'delivery' mode) */
  min_delivery_days?: number;
  /** Maximum days to deliver (for 'delivery' mode) */
  max_delivery_days?: number;
  /** Flat delivery fee in EGP */
  delivery_fee_egp?: number;
  /** Cart total (EGP) above which delivery is free */
  free_delivery_threshold_egp?: number;
  /** Governs where pickup is available (for 'pickup' mode) */
  pickup_governorate?: string;
  /** Whether the seller ships outside their home governorate */
  ships_nationwide?: boolean;
}

/* ── NotificationPrefs ─────────────────────────────────────────────────────
 * buyer_profiles.notification_prefs JSONB  (C3 §3, buyer_profiles table)
 * DB default: {"push":true,"sms":true,"whatsapp":true,"email":false}
 * Each key maps to the notification_channel enum values.
 */
export interface NotificationPrefs {
  push?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  email?: boolean;
}

/* ── NotificationData ──────────────────────────────────────────────────────
 * notifications.data JSONB  (C3 §3, notifications table)
 * Flexible payload keyed by notification type; all fields optional to
 * accommodate the variety of system events that produce notifications.
 */
export interface NotificationData {
  /** Primary entity UUID (order_id, listing_id, dispute_id, etc.) */
  entity_id?: string;
  /** Discriminator for the entity kind */
  entity_type?: "order" | "listing" | "dispute" | "payout" | "review" | "inquiry" | "boost";
  /** Deep-link for client-side navigation on tap/click */
  action_url?: string;
  /** Human-readable secondary reference (e.g. order number string) */
  reference?: string;
  /** Numeric amount, if relevant (e.g. payout EGP, order total) */
  amount_egp?: number;
  /** Extra key-value pairs for future notification types */
  [key: string]: unknown;
}

/* ── getTyped ─────────────────────────────────────────────────────────────
 * Safely casts an opaque JSONB `Json` value to a concrete interface T.
 *
 * This is NOT a runtime validator — it performs a type assertion only.
 * For user-supplied data, validate with Zod before calling getTyped.
 * For system-generated JSONB (DB defaults, internal writes), this is safe.
 *
 * @example
 *   const prefs = getTyped<NotificationPrefs>(profile.notification_prefs)
 *   if (prefs.whatsapp) { ... }
 */
export function getTyped<T>(json: Json): T {
  return json as unknown as T;
}
