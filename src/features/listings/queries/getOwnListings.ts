/**
 * getOwnListings — the Listings Management table (`/seller/listings`, T03).
 * Phase 05 / T02 (FR-SEL-8).
 *
 * Own-store scope: runs under the caller's auth context (cookie client in RSC;
 * an authenticated client injected in tests). The caller's store id is resolved
 * from the session and pinned into the WHERE (`.eq("store_id", storeId)`) on top
 * of the `listings_public` own-store SELECT branch — so only the caller's own
 * listings ever surface, at ANY status (draft/active/sold_out/paused/removed),
 * unlike the public browse queries which see active/sold_out only.
 *
 * Status filter = the T03 tabs. The "removed" tab reads the soft-deleted set
 * (status='removed'; soft delete sets status='removed' + deleted_at together —
 * R-L10, see softDeleteListing). "all" shows every status. Offset-paginated.
 *
 * Returns an empty page when the caller isn't a seller with a store.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  getOwnListingsParamsSchema,
  type GetOwnListingsParams,
} from "@/validations/listings";
import type { OwnListingRow, OwnListingsPage } from "../types";
import { resolveCallerStoreId, type ListingsClient } from "./_shared";

const OWN_LISTING_SELECT = `
  id, type, title_ar, title_en, price, price_type, status, stock_qty,
  is_made_to_order, low_stock_threshold, view_count, inquiry_count, created_at,
  listing_images ( url, sort_order )
`;

interface RawOwnListingRow {
  id: string;
  type: Database["betk"]["Enums"]["listing_type"];
  title_ar: string;
  title_en: string | null;
  price: number | null;
  price_type: Database["betk"]["Enums"]["price_type"];
  status: Database["betk"]["Enums"]["listing_status"];
  stock_qty: number | null;
  is_made_to_order: boolean;
  low_stock_threshold: number;
  view_count: number;
  inquiry_count: number;
  created_at: string;
  listing_images: { url: string; sort_order: number }[] | null;
}

function pickHero(images: { url: string; sort_order: number }[] | null): string | null {
  const list = images ?? [];
  if (list.length === 0) return null;
  const zero = list.find((i) => i.sort_order === 0);
  if (zero) return zero.url;
  return [...list].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

function mapRow(row: RawOwnListingRow): OwnListingRow {
  return {
    id: row.id,
    type: row.type,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    price: row.price,
    priceType: row.price_type,
    status: row.status,
    stockQty: row.stock_qty,
    isMadeToOrder: row.is_made_to_order,
    lowStockThreshold: row.low_stock_threshold,
    viewCount: row.view_count,
    inquiryCount: row.inquiry_count,
    createdAt: row.created_at,
    heroImageUrl: pickHero(row.listing_images),
  };
}

export async function getOwnListings(
  params: GetOwnListingsParams = {},
  client?: ListingsClient,
): Promise<OwnListingsPage> {
  const { status, page, pageSize } = getOwnListingsParamsSchema.parse(params);
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerStoreId(supabase);
  if (!scope) {
    return { items: [], page, pageSize, total: 0, hasMore: false };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .schema("betk")
    .from("listings")
    .select(OWN_LISTING_SELECT, { count: "exact" })
    .eq("store_id", scope.storeId);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`[listings] getOwnListings failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawOwnListingRow[];
  const total = count ?? 0;
  return {
    items: rows.map(mapRow),
    page,
    pageSize,
    total,
    hasMore: from + rows.length < total,
  };
}
