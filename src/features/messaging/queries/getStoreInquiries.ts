/**
 * getStoreInquiries — the SELLER inbox thread list (`/seller/inbox`, T04).
 * Phase 06 / T02 (FR-SEL-13).
 *
 * Seller scope: pinned to `store_id = the caller's own store` (resolved from the
 * session) on top of the `inq_buyer` SELECT branch (buyer OR store OR admin).
 * Optional status filter = the T04 tabs (the inquiry_status members + "all").
 *
 * REG-43 (DECISION 4 — DERIVE-AT-READ): ordered by the DERIVED latest activity,
 * so a BUYER's newest message re-sorts the seller's inbox to the top too.
 *
 * REG-44 (flagged): the BUYER's display name is NOT surfaced — ERD §3 row 39
 * specs `buyer_profiles` SELECT = "self or admin (public name/gov for
 * discovery)" but the live `bp_self` policy is self/admin-only, so a seller
 * cannot read a buyer's name via RLS. We surface `buyerId` only (no
 * service-role reach-around); T04 renders a neutral label. See SESSION_CONTEXT
 * REG-44.
 *
 * REG-42 (DECISION 3 — DEFER): no unread flag.
 *
 * Returns an empty list when the caller isn't a seller with a store.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  getStoreInquiriesParamsSchema,
  type GetStoreInquiriesParams,
} from "@/validations/messaging";
import { latestActivityAt, lastMessagePreview } from "../messagingRules";
import type { InquirySummary } from "../types";
import { resolveCallerScope, type MessagingClient } from "./_shared";

const STORE_INQUIRY_SELECT = `
  id, buyer_id, status, buyer_first_message, converted_to_order_id, created_at,
  listings ( id, title_ar, title_en, listing_images ( url, sort_order ) ),
  inquiry_messages ( body, sent_at )
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
interface RawStoreInquiryRow {
  id: string;
  buyer_id: string;
  status: Database["betk"]["Enums"]["inquiry_status"];
  buyer_first_message: string;
  converted_to_order_id: string | null;
  created_at: string;
  listings: RawListing | RawListing[] | null;
  inquiry_messages: { body: string; sent_at: string }[] | null;
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

function mapRow(row: RawStoreInquiryRow): InquirySummary {
  const listing = asSingle(row.listings);
  const messages = (row.inquiry_messages ?? []).map((m) => ({ body: m.body, sentAt: m.sent_at }));
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
    store: null,
    buyerId: row.buyer_id, // REG-44: buyer name is RLS-unreachable; id only.
  };
}

export async function getStoreInquiries(
  params: GetStoreInquiriesParams = {},
  client?: MessagingClient,
): Promise<InquirySummary[]> {
  const { status } = getStoreInquiriesParamsSchema.parse(params);
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerScope(supabase);
  if (!scope || scope.storeId === null) return [];

  let query = supabase
    .schema("betk")
    .from("inquiries")
    .select(STORE_INQUIRY_SELECT)
    .eq("store_id", scope.storeId);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[messaging] getStoreInquiries failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawStoreInquiryRow[];
  return rows
    .map(mapRow)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}
