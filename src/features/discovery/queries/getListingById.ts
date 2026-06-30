/**
 * getListingById — listing detail page query. Phase 03 / T01 (FR-PUB-4).
 *
 * Full `listings` row + `listing_images` (ordered) + `listing_tags` + owning
 * `stores` + `seller_profiles` + `rating_aggregates` + the store's recent
 * visible reviews (`is_visible`) + `review_photos`. Returns `null` for a
 * missing, soft-deleted (`deleted_at`), or RLS-denied row (R-L10) — the page
 * (T05) 404s on null.
 *
 * `listings_public` RLS only exposes `status='active' AND deleted_at IS NULL`
 * to non-owners. A `sold_out`/`paused`/`draft`/`removed` listing therefore
 * ALSO resolves to `null` here today — see the FINDING below, this is flagged
 * for review, not patched with a policy in T01.
 *
 * NOTE — `view_count` increment (FR-PUB-4) is intentionally NOT done here.
 * T01 is a read-only query layer ("NO writes"); T05 (listing detail page)
 * owns confirming + implementing the increment mechanism.
 *
 * Runs under the cookie/anon server client.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getTyped, type StoreDeliveryOptions } from "@/types/jsonb";
import { listingIdSchema } from "@/validations/discovery";
import type { ListingDetail } from "../types";
import {
  fetchVisibleReviewsByStore,
  mapSellerProfile,
  mapStoreSummary,
  asSingle,
  type DiscoveryClient,
  type RawListingImage,
  type RawSellerProfile,
  type RawStoreSummary,
} from "./_shared";

const LISTING_DETAIL_SELECT = `
  id, store_id, category_id, subcategory_id, type, title_ar, title_en, description_ar,
  price, price_type, status, stock_qty, low_stock_threshold, is_made_to_order,
  accepts_custom_orders, custom_order_notes, view_count, created_at, delivery_options,
  listing_images ( url, sort_order ),
  listing_tags ( tag ),
  stores (
    id, name_ar, name_en, slug, avatar_url, governorate, city,
    rating_aggregates ( average_rating, total_reviews, rating_1, rating_2, rating_3, rating_4, rating_5 ),
    seller_profiles ( id, level, is_verified, avg_response_hours )
  )
`;

interface RawListingDetailStore extends RawStoreSummary {
  seller_profiles: RawSellerProfile | RawSellerProfile[] | null;
}

interface RawListingDetailRow {
  id: string;
  store_id: string;
  category_id: string;
  subcategory_id: string | null;
  type: Database["betk"]["Enums"]["listing_type"];
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  price: number | null;
  price_type: Database["betk"]["Enums"]["price_type"];
  status: Database["betk"]["Enums"]["listing_status"];
  stock_qty: number | null;
  low_stock_threshold: number;
  is_made_to_order: boolean;
  accepts_custom_orders: boolean;
  custom_order_notes: string | null;
  view_count: number;
  created_at: string;
  delivery_options: Database["betk"]["Tables"]["listings"]["Row"]["delivery_options"];
  listing_images: RawListingImage[] | null;
  listing_tags: { tag: string }[] | null;
  stores: RawListingDetailStore | RawListingDetailStore[] | null;
}

/**
 * @param id      listing UUID (from the `/listing/[id]` route param).
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function getListingById(
  id: string,
  client?: DiscoveryClient,
): Promise<ListingDetail | null> {
  const parsedId = listingIdSchema.parse(id);
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("listings")
    .select(LISTING_DETAIL_SELECT)
    .eq("id", parsedId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`[discovery] getListingById failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawListingDetailRow;
  const store = asSingle(row.stores);
  // listings.store_id is NOT NULL + FK — a missing embed here means the
  // store itself is RLS-denied (e.g. suspended), not a data-integrity gap.
  if (!store) return null;

  const reviews = await fetchVisibleReviewsByStore(supabase, store.id);
  const storeSummary = mapStoreSummary(store);
  if (!storeSummary) return null;

  return {
    id: row.id,
    storeId: row.store_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    type: row.type,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    descriptionAr: row.description_ar,
    price: row.price,
    priceType: row.price_type,
    status: row.status,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    isMadeToOrder: row.is_made_to_order,
    acceptsCustomOrders: row.accepts_custom_orders,
    customOrderNotes: row.custom_order_notes,
    viewCount: row.view_count,
    createdAt: row.created_at,
    deliveryOptions: getTyped<StoreDeliveryOptions>(row.delivery_options),
    images: (row.listing_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({ url: img.url, sortOrder: img.sort_order })),
    tags: (row.listing_tags ?? []).map((t) => t.tag),
    store: storeSummary,
    seller: mapSellerProfile(asSingle(store.seller_profiles)),
    reviews,
  };
}
