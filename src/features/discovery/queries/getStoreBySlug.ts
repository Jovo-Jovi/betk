/**
 * getStoreBySlug — public storefront query. Phase 03 / T01 (FR-PUB-5, R-S07).
 *
 * `stores WHERE slug AND status='active'` (`stores_public` RLS) + its
 * `seller_profiles` + `rating_aggregates` + active listings + recent visible
 * reviews. Suspended/pending stores and unknown slugs both resolve to `null`
 * (RLS denial and "no row" are indistinguishable by design — R-S07, no
 * existence leak) — the page (T06) 404s on null.
 *
 * Runs under the cookie/anon server client.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getTyped, type StoreDeliveryOptions, type StorePaymentMethods } from "@/types/jsonb";
import { storeSlugSchema } from "@/validations/discovery";
import type { StoreDetail } from "../types";
import {
  LISTINGS_PAGE_SIZE,
  LISTING_SUMMARY_SELECT,
  fetchVisibleReviewsByStore,
  mapListingSummaryRow,
  mapRatingAggregate,
  mapSellerProfile,
  asSingle,
  type DiscoveryClient,
  type RawListingSummaryRow,
  type RawRatingAggregate,
  type RawSellerProfile,
} from "./_shared";

const STORE_DETAIL_SELECT = `
  id, slug, name_ar, name_en, bio_ar, avatar_url, cover_url, governorate, city,
  return_policy, min_order_egp, payment_methods, delivery_options, created_at,
  rating_aggregates ( average_rating, total_reviews, rating_1, rating_2, rating_3, rating_4, rating_5 ),
  seller_profiles ( id, level, is_verified, avg_response_hours )
`;

type StoreRow = Database["betk"]["Tables"]["stores"]["Row"];

interface RawStoreDetailRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  bio_ar: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  governorate: string;
  city: string | null;
  return_policy: string | null;
  min_order_egp: number | null;
  payment_methods: StoreRow["payment_methods"];
  delivery_options: StoreRow["delivery_options"];
  created_at: string;
  rating_aggregates: RawRatingAggregate | RawRatingAggregate[] | null;
  seller_profiles: RawSellerProfile | RawSellerProfile[] | null;
}

/**
 * @param slug    store slug (from the `/store/[slug]` route param).
 * @param client  Supabase client override (integration tests inject a plain
 *                anon client; RSC callers omit this and get the cookie client).
 */
export async function getStoreBySlug(
  slug: string,
  client?: DiscoveryClient,
): Promise<StoreDetail | null> {
  const parsedSlug = storeSlugSchema.parse(slug);
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select(STORE_DETAIL_SELECT)
    .eq("slug", parsedSlug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`[discovery] getStoreBySlug failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawStoreDetailRow;

  const [listingsResult, reviews] = await Promise.all([
    supabase
      .schema("betk")
      .from("listings")
      .select(LISTING_SUMMARY_SELECT)
      .eq("store_id", row.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LISTINGS_PAGE_SIZE),
    fetchVisibleReviewsByStore(supabase, row.id),
  ]);

  if (listingsResult.error) {
    throw new Error(`[discovery] getStoreBySlug listings failed: ${listingsResult.error.message}`);
  }
  const listingRows = (listingsResult.data ?? []) as unknown as RawListingSummaryRow[];

  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    bioAr: row.bio_ar,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    governorate: row.governorate,
    city: row.city,
    returnPolicy: row.return_policy,
    minOrderEgp: row.min_order_egp,
    paymentMethods: getTyped<StorePaymentMethods>(row.payment_methods),
    deliveryOptions: getTyped<StoreDeliveryOptions>(row.delivery_options),
    createdAt: row.created_at,
    seller: mapSellerProfile(asSingle(row.seller_profiles)),
    rating: mapRatingAggregate(asSingle(row.rating_aggregates)),
    listings: listingRows.map(mapListingSummaryRow),
    reviews,
  };
}
