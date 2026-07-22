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
 * REG-42 (DECISION 3 — DEFER): `isRead` is surfaced as stored, but NO mark-read
 * write exists (the reader cannot flip the other party's is_read under ERD §3
 * row 52) — T03/T04 do not render an unread indicator.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { InquiryThread } from "../types";
import type { MessagingClient } from "./_shared";

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
  const messages = (row.inquiry_messages ?? [])
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
  };
}
