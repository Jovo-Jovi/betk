/**
 * Messaging feature — typed return shapes for the read layer. Phase 06 / T02.
 * Hand-typed camelCase wrappers over `Database["betk"]["Tables"]` rows.
 *
 * REG-42 (CLOSED, T02-FIX — DECISION 3 REVISED, was DEFER): the unread mechanism
 * is `inquiry_messages.is_read` and it is now RECEIVER-writable (authorized ERD §3
 * row-52 amendment + migration 20260722124510). The inbox summaries carry
 * `unreadCount` (messages from the OTHER party not yet read by the caller) and the
 * thread carries per-message `isRead` + a thread-level `unreadCount`; the
 * `markInquiryRead` action flips them on view. See SESSION_CONTEXT REG-42.
 *
 * REG-43 (DECISION 4 — DERIVE-AT-READ): `lastActivityAt` is DERIVED from the
 * latest message (or the inquiry's createdAt when the thread is empty), NOT read
 * from `inquiries.last_message_at` (which is left stale at its INSERT default).
 */

import type { Database } from "@/lib/supabase/types";

type E = Database["betk"]["Enums"];

/** Listing context shown on an inquiry row / thread header. */
export interface InquiryListingContext {
  id: string;
  titleAr: string;
  titleEn: string | null;
  heroImageUrl: string | null;
}

/** Store context shown on the BUYER's inbox row (buyer reads the active store). */
export interface InquiryStoreContext {
  id: string;
  nameAr: string;
  nameEn: string | null;
  slug: string;
}

/** One row in the buyer inbox (`/inbox`, T03) or seller inbox (`/seller/inbox`, T04). */
export interface InquirySummary {
  id: string;
  status: E["inquiry_status"];
  /** REG-43 derive-at-read sort key (ISO) — max(createdAt, max message sentAt). */
  lastActivityAt: string;
  /** Most recent message body, or the buyer's opening message (ADR-014). */
  lastMessagePreview: string;
  createdAt: string;
  /** Phase-07 checkout link target once set; NULL through all of Phase 06. */
  convertedToOrderId: string | null;
  listing: InquiryListingContext | null;
  /** Present on the BUYER inbox (store is publicly readable); null on the seller inbox. */
  store: InquiryStoreContext | null;
  /** Present on the SELLER inbox; the buyer's display name is RLS-unreachable (REG-44). */
  buyerId: string | null;
  /**
   * REG-42 (T02-FIX): count of messages from the OTHER party not yet read by the
   * caller — the inbox-row unread badge. 0 when the thread is fully read (or has
   * no reply-thread messages yet; the buyer's opening message is not a message row).
   */
  unreadCount: number;
}

/** One message bubble in a thread. */
export interface InquiryMessage {
  id: string;
  senderId: string;
  senderType: E["sender_type"];
  body: string;
  sentAt: string;
  isRead: boolean;
}

/**
 * Full thread (`/inbox/[id]`, `/seller/inbox/[id]`). Returned only to
 * participants; `getInquiryThread` returns null for outsiders (→ 404).
 *
 * T03 query-layer merge (additive, no action change): `messages[0]` is always
 * a synthetic entry carrying the inquiry's `buyerFirstMessage` (ADR-014,
 * senderType `'buyer'`, sentAt = `createdAt`) — `MessageThread` can therefore
 * be composed AS-IS against the flat `messages` list without any UI-layer
 * splicing. `buyerFirstMessage` remains on this shape too (the raw ADR-014
 * field), for any consumer that wants it standalone.
 */
export interface InquiryThread {
  id: string;
  buyerId: string;
  storeId: string;
  status: E["inquiry_status"];
  quantity: number | null;
  deliveryPreference: E["delivery_preference"] | null;
  specialRequests: string | null;
  buyerFirstMessage: string;
  convertedToOrderId: string | null;
  createdAt: string;
  listing: InquiryListingContext | null;
  messages: InquiryMessage[];
  /**
   * REG-42 (T02-FIX): count of messages from the OTHER party the caller has not
   * read yet — drives the "mark read on view" call (markInquiryRead) and any
   * thread-level unread affordance. Derived from `messages` + the caller's uid.
   */
  unreadCount: number;
}
