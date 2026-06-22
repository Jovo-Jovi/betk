/**
 * Enum literal unions — mirrors betk schema enums from C3 §2 exactly.
 * Source of truth: src/lib/supabase/types.ts  Database["betk"]["Enums"]
 * Every entry here must stay in sync with the generated types; the CI
 * types-drift check (T13) will catch divergence.
 *
 * Usage: import { OrderStatus } from "@/constants/enums"
 */

import type { Database } from "@/lib/supabase/types";

/* ── convenience alias ─────────────────────────────────────── */
type E = Database["betk"]["Enums"];

/* ── identity / auth ───────────────────────────────────────── */
export type AuthProvider     = E["auth_provider"];      // 'phone' | 'google'
export type UserRole         = E["user_role"];          // 'buyer' | 'seller' | 'admin' | 'superadmin'
export type UserStatus       = E["user_status"];        // 'active' | 'suspended' | 'banned' | 'pending'

/* ── seller / store ────────────────────────────────────────── */
export type SellerStatus     = E["seller_status"];      // 'pending' | 'active' | 'suspended' | 'banned'
export type SellerLevel      = E["seller_level"];       // 'bronze' | 'silver' | 'gold'
export type StoreStatus      = E["store_status"];       // 'pending' | 'active' | 'suspended'

/* ── catalog / listings ────────────────────────────────────── */
export type ListingStatus    = E["listing_status"];     // 'draft' | 'active' | 'sold_out' | 'paused' | 'removed'
export type ListingType      = E["listing_type"];       // 'product' | 'service'
export type PriceType        = E["price_type"];         // 'fixed' | 'per_hour' | 'starting_from' | 'quote_only'
export type DeliveryPreference = E["delivery_preference"]; // 'delivery' | 'pickup' | 'remote'

/* ── orders ────────────────────────────────────────────────── */
export type OrderStatus      = E["order_status"];       // 'pending' | 'confirmed' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled' | 'returned'
export type CancelledByType  = E["cancelled_by_type"];  // 'buyer' | 'seller' | 'admin' | 'system'

/* ── payments / payouts ────────────────────────────────────── */
export type PaymentMethod    = E["payment_method"];     // 'instapay' | 'vodafone_cash' | 'orange_cash' | 'cod'
export type PaymentStatus    = E["payment_status"];     // 'pending' | 'confirmed' | 'failed' | 'refunded'
export type PaymentType      = E["payment_type"];       // 'deposit' | 'balance'
export type PayoutMethod     = E["payout_method"];      // 'instapay' | 'vodafone_cash' | 'orange_cash'
export type PayoutStatus     = E["payout_status"];      // 'pending' | 'processing' | 'processed' | 'rejected'

/* ── shipping ──────────────────────────────────────────────── */
export type ShipmentStatus   = E["shipment_status"];    // 'created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned'

/* ── messaging / inquiries ─────────────────────────────────── */
export type InquiryStatus    = E["inquiry_status"];     // 'open' | 'replied' | 'confirmed' | 'declined' | 'expired'
export type SenderType       = E["sender_type"];        // 'buyer' | 'seller' | 'admin' | 'system'

/* ── reviews / disputes ────────────────────────────────────── */
export type DisputeStatus    = E["dispute_status"];     // 'submitted' | 'under_review' | 'awaiting_seller' | 'resolved' | 'closed'
export type DisputeReason    = E["dispute_reason"];     // 'not_received' | 'not_as_described' | 'damaged' | 'wrong_item' | 'return_request' | 'refund_request'
export type DisputeResolution = E["dispute_resolution"];// 'buyer_favour' | 'seller_favour' | 'partial' | 'no_action'

/* ── boosts ────────────────────────────────────────────────── */
export type BoostStatus      = E["boost_status"];       // 'pending_payment' | 'active' | 'expired' | 'cancelled'

/* ── notifications ─────────────────────────────────────────── */
export type NotificationChannel = E["notification_channel"]; // 'push' | 'sms' | 'whatsapp' | 'email'

/* ── admin / moderation ────────────────────────────────────── */
export type FlagReason       = E["flag_reason"];        // 'misleading' | 'counterfeit' | 'inappropriate' | 'spam' | 'prohibited' | 'wrong_category'
export type FlagSeverity     = E["flag_severity"];      // 'low' | 'medium' | 'high'
export type FlagStatus       = E["flag_status"];        // 'pending' | 'reviewed' | 'actioned' | 'dismissed'
export type ModerationTarget = E["moderation_target"];  // 'seller' | 'buyer' | 'listing' | 'review' | 'dispute' | 'payout'
export type StrikeType       = E["strike_type"];        // 'warning' | 'temp_suspension' | 'permanent_ban'
export type CollectionStatus = E["collection_status"];  // 'draft' | 'live' | 'scheduled' | 'archived'
export type ContentType      = E["content_type"];       // 'listing' | 'review'

/* ── seller documents ──────────────────────────────────────── */
export type DocType          = E["doc_type"];           // 'national_id_front' | 'national_id_back'
export type DocReviewStatus  = E["doc_review_status"];  // 'pending' | 'approved' | 'rejected'
