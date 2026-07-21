/**
 * Listings feature — typed return shapes for the seller-side write/read layer.
 * Phase 05 / T02. Hand-typed camelCase wrappers over `Database["betk"]["Tables"]`
 * rows; JSONB narrowed via `@/types/jsonb`.
 */

import type { Database } from "@/lib/supabase/types";
import type { StoreDeliveryOptions } from "@/types/jsonb";

type E = Database["betk"]["Enums"];

/** One row in the Listings Management table (`/seller/listings`, T03). */
export interface OwnListingRow {
  id: string;
  type: E["listing_type"];
  titleAr: string;
  titleEn: string | null;
  price: number | null;
  priceType: E["price_type"];
  status: E["listing_status"];
  stockQty: number | null;
  isMadeToOrder: boolean;
  lowStockThreshold: number;
  viewCount: number;
  inquiryCount: number;
  createdAt: string;
  /** Hero image (sort_order 0), or null if none uploaded yet. */
  heroImageUrl: string | null;
}

export interface OwnListingsPage {
  items: OwnListingRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** The edit-form prefill (`/seller/listings/[id]/edit`, T04). */
export interface OwnListingDetail {
  id: string;
  storeId: string;
  type: E["listing_type"];
  titleAr: string;
  titleEn: string | null;
  descriptionAr: string | null;
  categoryId: string;
  subcategoryId: string | null;
  price: number | null;
  priceType: E["price_type"];
  status: E["listing_status"];
  stockQty: number | null;
  isMadeToOrder: boolean;
  lowStockThreshold: number;
  acceptsCustomOrders: boolean;
  customOrderNotes: string | null;
  deliveryOptions: StoreDeliveryOptions;
  viewCount: number;
  inquiryCount: number;
  createdAt: string;
  images: { id: string; url: string; sortOrder: number }[];
  tags: string[];
}

/** One row in the Stock & Inventory table (`/seller/inventory`, T05). */
export interface OwnInventoryItem {
  id: string;
  type: E["listing_type"];
  titleAr: string;
  titleEn: string | null;
  status: E["listing_status"];
  stockQty: number | null;
  lowStockThreshold: number;
  isMadeToOrder: boolean;
  /** Hero image (sort_order 0), or null. */
  heroImageUrl: string | null;
}
