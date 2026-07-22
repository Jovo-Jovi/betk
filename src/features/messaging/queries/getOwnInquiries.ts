/**
 * getOwnInquiries — the BUYER inbox thread list (`/inbox`, T03). Phase 06 / T02
 * (FR-BUY-5).
 *
 * Buyer scope: runs under the caller's auth context (cookie client in RSC; an
 * authenticated client injected in tests). Pinned to `buyer_id = self` on top of
 * the `inq_buyer` SELECT branch (buyer OR store OR admin) so only the caller's
 * OWN buyer-side inquiries surface (a caller who is also a seller doesn't see
 * their store's inbox here — that's getStoreInquiries).
 *
 * REG-43 (DECISION 4 — DERIVE-AT-READ): ordered by the DERIVED latest activity
 * (max message sentAt, or createdAt when the thread is empty), NOT by the stale
 * `inquiries.last_message_at`. So a buyer's own newest message re-sorts their
 * thread to the top.
 *
 * REG-42 (T02-FIX — CLOSED): each row carries `unreadCount` = messages from the
 * OTHER party (the seller) not yet read by this buyer (`sender_id != self AND
 * is_read = false`). T03 renders the unread badge; the thread view flips them via
 * `markInquiryRead`.
 *
 * Returns an empty list when the caller has no session.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { latestActivityAt, lastMessagePreview } from "../messagingRules";
import type { InquirySummary } from "../types";
import { resolveCallerUserId, type MessagingClient } from "./_shared";

const OWN_INQUIRY_SELECT = `
  id, status, buyer_first_message, converted_to_order_id, created_at,
  listings ( id, title_ar, title_en, listing_images ( url, sort_order ) ),
  stores ( id, name_ar, name_en, slug ),
  inquiry_messages ( body, sent_at, sender_id, is_read )
`;

interface RawImage {
  url: string;
  sort_order: number;
}
interface RawListing {
  id: string;
  title_ar: string;
  title_en: string | null;
  listing_images: RawImage[] | null;
}
interface RawStore {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
}
interface RawInquiryRow {
  id: string;
  status: Database["betk"]["Enums"]["inquiry_status"];
  buyer_first_message: string;
  converted_to_order_id: string | null;
  created_at: string;
  listings: RawListing | RawListing[] | null;
  stores: RawStore | RawStore[] | null;
  inquiry_messages: { body: string; sent_at: string; sender_id: string; is_read: boolean }[] | null;
}

function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function pickHero(images: RawImage[] | null): string | null {
  const list = images ?? [];
  if (list.length === 0) return null;
  const zero = list.find((i) => i.sort_order === 0);
  if (zero) return zero.url;
  return [...list].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

function mapRow(row: RawInquiryRow, callerUserId: string): InquirySummary {
  const listing = asSingle(row.listings);
  const store = asSingle(row.stores);
  const rawMessages = row.inquiry_messages ?? [];
  const messages = rawMessages.map((m) => ({ body: m.body, sentAt: m.sent_at }));
  const unreadCount = rawMessages.filter(
    (m) => m.sender_id !== callerUserId && !m.is_read,
  ).length;
  return {
    id: row.id,
    status: row.status,
    lastActivityAt: latestActivityAt(
      row.created_at,
      messages.map((m) => m.sentAt),
    ),
    lastMessagePreview: lastMessagePreview(row.buyer_first_message, messages),
    createdAt: row.created_at,
    convertedToOrderId: row.converted_to_order_id,
    listing: listing
      ? {
          id: listing.id,
          titleAr: listing.title_ar,
          titleEn: listing.title_en,
          heroImageUrl: pickHero(listing.listing_images),
        }
      : null,
    store: store
      ? { id: store.id, nameAr: store.name_ar, nameEn: store.name_en, slug: store.slug }
      : null,
    buyerId: null,
    unreadCount,
  };
}

export async function getOwnInquiries(client?: MessagingClient): Promise<InquirySummary[]> {
  const supabase = client ?? (await createClient());
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .schema("betk")
    .from("inquiries")
    .select(OWN_INQUIRY_SELECT)
    .eq("buyer_id", userId);

  if (error) {
    throw new Error(`[messaging] getOwnInquiries failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawInquiryRow[];
  return rows
    .map((row) => mapRow(row, userId))
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}
