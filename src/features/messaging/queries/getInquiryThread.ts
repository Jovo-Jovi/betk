/**
 * getInquiryThread — a single inquiry thread (`/inbox/[id]`, `/seller/inbox/[id]`).
 * Phase 06 / T02 (FR-BUY-5, FR-SEL-13).
 *
 * Participant-scoped by RLS: `inq_buyer` returns the inquiry ONLY to its buyer,
 * owning store, or admin; `inq_msg_select` returns the messages to the same
 * parties. An OUTSIDER (or an unknown/malformed id) reads zero rows → this
 * returns **null**, which T03/T04 turn into a hard `notFound()` (404). No
 * separate ownership branch is needed — the RLS default-deny IS the 404.
 *
 * The opening bubble is the inquiry's `buyerFirstMessage` (ADR-014); `messages`
 * are the reply thread ordered sent_at ASC.
 *
 * REG-42 (T02-FIX — CLOSED): `isRead` is surfaced per message AND the thread
 * carries `unreadCount` = messages from the OTHER party the caller hasn't read.
 * T03/T04 render the read state and call `markInquiryRead` on view to flip the
 * other party's messages (authorized receiver write, migration 20260722124510).
 *
 * T03 FINDING (query-layer merge, additive, no action change): T02 shipped
 * `buyerFirstMessage` as a SEPARATE field from `messages` (ADR-014 said "T03/T04
 * render the opening bubble from buyerFirstMessage" — i.e. compose it at the UI
 * layer). Composing `MessageThread` AS-IS against a flat `ThreadMessage[]` prop
 * means a UI-layer composition would have to splice the opening bubble in by
 * hand at every consumer (T03 buyer + T04 seller) — easy to forget, and the
 * T02 integration test asserted `messages.length === 0` on a zero-reply inquiry,
 * proving the opening text is NOT in `messages` today. So the opening message IS
 * merged HERE, once, as the synthetic first entry of `messages` (id
 * `"<inquiryId>-opening"`, senderType `'buyer'`, sentAt = the inquiry's
 * `created_at` — always earliest, since no reply can predate the inquiry that
 * opens the thread). `unreadCount` is computed from the REAL `inquiry_messages`
 * rows BEFORE the merge (buyer_first_message has no `is_read` column and was
 * never part of the unread mechanism — REG-42 — so this must not change that).
 * `buyerFirstMessage` stays on the return shape too (non-breaking, still the
 * ADR-014-cited raw field) — `messages[0]` is the rendering-ready duplicate.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { InquiryThread } from "../types";
import { resolveCallerUserId, type MessagingClient } from "./_shared";

const THREAD_SELECT = `
  id, buyer_id, store_id, status, quantity, delivery_preference, special_requests,
  buyer_first_message, converted_to_order_id, created_at,
  listings ( id, title_ar, title_en, listing_images ( url, sort_order ) ),
  inquiry_messages ( id, sender_id, sender_type, body, is_read, sent_at )
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
interface RawMessage {
  id: string;
  sender_id: string;
  sender_type: Database["betk"]["Enums"]["sender_type"];
  body: string;
  is_read: boolean;
  sent_at: string;
}
interface RawThreadRow {
  id: string;
  buyer_id: string;
  store_id: string;
  status: Database["betk"]["Enums"]["inquiry_status"];
  quantity: number | null;
  delivery_preference: Database["betk"]["Enums"]["delivery_preference"] | null;
  special_requests: string | null;
  buyer_first_message: string;
  converted_to_order_id: string | null;
  created_at: string;
  listings: RawListing | RawListing[] | null;
  inquiry_messages: RawMessage[] | null;
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

export async function getInquiryThread(
  inquiryId: string,
  client?: MessagingClient,
): Promise<InquiryThread | null> {
  const supabase = client ?? (await createClient());
  const callerUserId = await resolveCallerUserId(supabase);

  const { data, error } = await supabase
    .schema("betk")
    .from("inquiries")
    .select(THREAD_SELECT)
    .eq("id", inquiryId)
    .maybeSingle();

  if (error) {
    // A malformed uuid surfaces as a 22P02 from PostgREST — treat as not-found
    // rather than a 500 (T03/T04 render notFound()).
    if (error.code === "22P02") return null;
    throw new Error(`[messaging] getInquiryThread failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawThreadRow;
  const listing = asSingle(row.listings);
  const replyMessages = (row.inquiry_messages ?? [])
    .slice()
    .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at))
    .map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      senderType: m.sender_type,
      body: m.body,
      sentAt: m.sent_at,
      isRead: m.is_read,
    }));

  // REG-42 (T02-FIX): unread = the OTHER party's REAL messages this caller
  // hasn't read. Computed BEFORE the opening-bubble merge below — the merged
  // synthetic entry has no is_read column and must never enter this count.
  const unreadCount = callerUserId
    ? replyMessages.filter((m) => m.senderId !== callerUserId && !m.isRead).length
    : 0;

  // T03 query-layer merge (see the header note): the opening bubble is
  // ALWAYS earliest (no message predates the inquiry that opens the thread),
  // so prepending is a safe merge, not a re-sort.
  const openingMessage = {
    id: `${row.id}-opening`,
    senderId: row.buyer_id,
    senderType: "buyer" as const,
    body: row.buyer_first_message,
    sentAt: row.created_at,
    isRead: true, // not a trackable unread item — excluded from unreadCount above
  };
  const messages = [openingMessage, ...replyMessages];

  return {
    id: row.id,
    buyerId: row.buyer_id,
    storeId: row.store_id,
    status: row.status,
    quantity: row.quantity,
    deliveryPreference: row.delivery_preference,
    specialRequests: row.special_requests,
    buyerFirstMessage: row.buyer_first_message,
    convertedToOrderId: row.converted_to_order_id,
    createdAt: row.created_at,
    listing: listing
      ? {
          id: listing.id,
          titleAr: listing.title_ar,
          titleEn: listing.title_en,
          heroImageUrl: pickHero(listing.listing_images),
        }
      : null,
    messages,
    unreadCount,
  };
}
