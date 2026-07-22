/**
 * Messaging feature — typed return shapes for the read layer. Phase 06 / T02.
 * Hand-typed camelCase wrappers over `Database["betk"]["Tables"]` rows.
 *
 * REG-42 (DECISION 3 — DEFER): NO unread state is surfaced. The unread column
 * (`inquiry_messages.is_read`) exists but the reader-driven mark-read WRITE is
 * not RLS-achievable additively under ERD §3 row 52 (sender-only UPDATE), so
 * T02 builds no `markInquiryRead` and the queries expose no unread flag — T03/T04
 * do NOT render an unread indicator (the flag stands; see SESSION_CONTEXT REG-42).
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
 * Full thread (`/inbox/[id]`, `/seller/inbox/[id]`). The opening bubble is the
 * inquiry's `buyerFirstMessage` (ADR-014) followed by `messages` (ASC). Returned
 * only to participants; `getInquiryThread` returns null for outsiders (→ 404).
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
}
