/**
 * getOwnListingById — the edit-form prefill (`/seller/listings/[id]/edit`, T04).
 * Phase 05 / T02 (FR-SEL-9).
 *
 * Own-store scope: the caller's store id is resolved from the session and
 * pinned (`.eq("store_id", storeId)`), so a listing that isn't the caller's —
 * or an unknown id — resolves to `null` (the T04 route hard-404s on null). Any
 * status is returned (draft/paused/etc.), unlike the public `getListingById`.
 * Soft-deleted (`deleted_at`) rows are NOT excluded here so the seller can still
 * inspect a removed listing from the "removed" tab; the route decides.
 *
 * Runs under the cookie client (RSC) or an injected authenticated client (tests).
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getTyped, type StoreDeliveryOptions } from "@/types/jsonb";
import { listingIdSchema } from "@/validations/discovery";
import type { OwnListingDetail } from "../types";
import { resolveCallerStoreId, type ListingsClient } from "./_shared";

const OWN_DETAIL_SELECT = `
  id, store_id, type, title_ar, title_en, description_ar, category_id, subcategory_id,
  price, price_type, status, stock_qty, is_made_to_order, low_stock_threshold,
  accepts_custom_orders, custom_order_notes, delivery_options, view_count,
  inquiry_count, created_at,
  listing_images ( id, url, sort_order ),
  listing_tags ( tag )
`;

interface RawOwnDetailRow {
  id: string;
  store_id: string;
  type: Database["betk"]["Enums"]["listing_type"];
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  category_id: string;
  subcategory_id: string | null;
  price: number | null;
  price_type: Database["betk"]["Enums"]["price_type"];
  status: Database["betk"]["Enums"]["listing_status"];
  stock_qty: number | null;
  is_made_to_order: boolean;
  low_stock_threshold: number;
  accepts_custom_orders: boolean;
  custom_order_notes: string | null;
  delivery_options: Database["betk"]["Tables"]["listings"]["Row"]["delivery_options"];
  view_count: number;
  inquiry_count: number;
  created_at: string;
  listing_images: { id: string; url: string; sort_order: number }[] | null;
  listing_tags: { tag: string }[] | null;
}

export async function getOwnListingById(
  id: string,
  client?: ListingsClient,
): Promise<OwnListingDetail | null> {
  const parsedId = listingIdSchema.parse(id);
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .select(OWN_DETAIL_SELECT)
    .eq("id", parsedId)
    .eq("store_id", scope.storeId)
    .maybeSingle();

  if (error) {
    throw new Error(`[listings] getOwnListingById failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawOwnDetailRow;
  return {
    id: row.id,
    storeId: row.store_id,
    type: row.type,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    price: row.price,
    priceType: row.price_type,
    status: row.status,
    stockQty: row.stock_qty,
    isMadeToOrder: row.is_made_to_order,
    lowStockThreshold: row.low_stock_threshold,
    acceptsCustomOrders: row.accepts_custom_orders,
    customOrderNotes: row.custom_order_notes,
    deliveryOptions: getTyped<StoreDeliveryOptions>(row.delivery_options),
    viewCount: row.view_count,
    inquiryCount: row.inquiry_count,
    createdAt: row.created_at,
    images: (row.listing_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({ id: img.id, url: img.url, sortOrder: img.sort_order })),
    tags: (row.listing_tags ?? []).map((t) => t.tag),
  };
}
