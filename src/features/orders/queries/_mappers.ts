/**
 * Orders query mappers — Phase 07 / T02b. Pure PostgREST-row → view-model shaping
 * shared by the buyer/seller/admin order queries. NO IO. (The `asSingle`/`pickHero`
 * helpers mirror the messaging query precedent.)
 *
 * REG-44 (FLAGGED): `buyerName` is NOT resolved here — the seller has no RLS read
 * path to buyer_profiles (`bp_self` = own/admin only) and no order-level name
 * snapshot was authorized in T02b, so it is returned `null`. `deliveryAddress`
 * embeds via the orders→addresses FK: `addr_self` (own/admin) populates it for the
 * BUYER's own detail + the ADMIN, and RLS nulls it for the SELLER — the same query
 * shape, RLS decides visibility. See types.ts for the owed REG-44 mechanism.
 */

import type { Database } from "@/lib/supabase/types";
import type {
  OrderSummary,
  OrderDetail,
  OrderPaymentView,
  OrderItemView,
  OrderTimelineEntry,
  OrderAddressView,
} from "../types";

type E = Database["betk"]["Enums"];

interface RawImage {
  url: string;
  sort_order: number;
}
interface RawItemListing {
  title_ar: string;
  title_en: string | null;
  listing_images: RawImage[] | null;
}
interface RawSummaryItem {
  listing_title_ar: string;
  listings: RawItemListing | RawItemListing[] | null;
}
interface RawDetailItem extends RawSummaryItem {
  id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
interface RawStore {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
}
interface RawPayment {
  id: string;
  payment_type: E["payment_type"];
  method: E["payment_method"];
  amount: number;
  status: E["payment_status"];
  proof_path: string | null;
  transfer_reference: string | null;
  confirmed_at: string | null;
}
interface RawHistory {
  id: string;
  from_status: E["order_status"] | null;
  to_status: E["order_status"];
  changed_by_type: E["cancelled_by_type"];
  notes: string | null;
  created_at: string;
}
interface RawAddress {
  label: string | null;
  street_address: string;
  city: string;
  governorate: string;
  building_notes: string | null;
}

export interface RawSummaryRow {
  id: string;
  betk_ref: string;
  status: E["order_status"];
  total_amount: number;
  created_at: string;
  buyer_id: string;
  store_id: string;
  stores: RawStore | RawStore[] | null;
  order_items: RawSummaryItem[] | null;
  payments: { payment_type: E["payment_type"]; status: E["payment_status"] }[] | null;
}

export interface RawDetailRow extends Omit<RawSummaryRow, "order_items" | "payments"> {
  subtotal: number;
  delivery_fee: number;
  delivery_method: E["delivery_preference"];
  cancellation_reason: string | null;
  cancelled_by: E["cancelled_by_type"] | null;
  confirmed_at: string | null;
  order_items: RawDetailItem[] | null;
  payments: RawPayment[] | null;
  order_status_history: RawHistory[] | null;
  addresses: RawAddress | RawAddress[] | null;
}

export const SUMMARY_SELECT = `
  id, betk_ref, status, total_amount, created_at, buyer_id, store_id,
  stores ( id, name_ar, name_en, slug ),
  order_items ( listing_title_ar, listings ( title_ar, title_en, listing_images ( url, sort_order ) ) ),
  payments ( payment_type, status )
`;

export const DETAIL_SELECT = `
  id, betk_ref, status, total_amount, subtotal, delivery_fee, delivery_method,
  cancellation_reason, cancelled_by, confirmed_at, created_at, buyer_id, store_id,
  stores ( id, name_ar, name_en, slug ),
  order_items ( id, listing_id, listing_title_ar, quantity, unit_price, subtotal,
                listings ( title_ar, title_en, listing_images ( url, sort_order ) ) ),
  payments ( id, payment_type, method, amount, status, proof_path, transfer_reference, confirmed_at ),
  order_status_history ( id, from_status, to_status, changed_by_type, notes, created_at ),
  addresses ( label, street_address, city, governorate, building_notes )
`;

export function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function pickHero(images: RawImage[] | null | undefined): string | null {
  const list = images ?? [];
  if (list.length === 0) return null;
  const zero = list.find((i) => i.sort_order === 0);
  if (zero) return zero.url;
  return [...list].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

function depositStatus(
  payments: { payment_type: E["payment_type"]; status: E["payment_status"] }[] | null,
): E["payment_status"] | null {
  return payments?.find((p) => p.payment_type === "deposit")?.status ?? null;
}

function summaryListing(items: RawSummaryItem[] | null): OrderSummary["listing"] {
  const first = (items ?? [])[0];
  if (!first) return null;
  const l = asSingle(first.listings);
  return {
    titleAr: first.listing_title_ar,
    titleEn: l?.title_en ?? null,
    heroImageUrl: pickHero(l?.listing_images),
  };
}

function summaryStore(store: RawStore | RawStore[] | null): OrderSummary["store"] {
  const s = asSingle(store);
  return s ? { id: s.id, nameAr: s.name_ar, nameEn: s.name_en, slug: s.slug } : null;
}

export function mapSummary(row: RawSummaryRow): OrderSummary {
  return {
    id: row.id,
    betkRef: row.betk_ref,
    status: row.status,
    total: row.total_amount,
    createdAt: row.created_at,
    listing: summaryListing(row.order_items),
    store: summaryStore(row.stores),
    depositStatus: depositStatus(row.payments),
    buyerName: null, // REG-44 (FLAGGED)
  };
}

/** deposit first, then balance — stable order for the detail payment panel. */
function mapPayment(p: RawPayment): OrderPaymentView {
  return {
    id: p.id,
    type: p.payment_type,
    method: p.method,
    amount: p.amount,
    status: p.status,
    proofPath: p.proof_path,
    transferReference: p.transfer_reference,
    confirmedAt: p.confirmed_at,
  };
}

function mapItem(i: RawDetailItem): OrderItemView {
  const l = asSingle(i.listings);
  return {
    id: i.id,
    listingId: i.listing_id,
    titleAr: l?.title_ar ?? i.listing_title_ar,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    subtotal: i.subtotal,
  };
}

function mapTimeline(h: RawHistory): OrderTimelineEntry {
  return {
    id: h.id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    changedByType: h.changed_by_type,
    notes: h.notes,
    createdAt: h.created_at,
  };
}

function mapAddress(a: RawAddress | RawAddress[] | null): OrderAddressView | null {
  const addr = asSingle(a);
  if (!addr) return null;
  return {
    label: addr.label,
    streetAddress: addr.street_address,
    city: addr.city,
    governorate: addr.governorate,
    buildingNotes: addr.building_notes,
  };
}

const PAYMENT_ORDER: Record<E["payment_type"], number> = { deposit: 0, balance: 1 };

export function mapDetail(row: RawDetailRow): OrderDetail {
  const summary = mapSummary({
    ...row,
    order_items: row.order_items,
    payments: (row.payments ?? []).map((p) => ({ payment_type: p.payment_type, status: p.status })),
  });
  return {
    ...summary,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    deliveryMethod: row.delivery_method,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    confirmedAt: row.confirmed_at,
    items: (row.order_items ?? []).map(mapItem),
    payments: (row.payments ?? [])
      .slice()
      .sort((a, b) => PAYMENT_ORDER[a.payment_type] - PAYMENT_ORDER[b.payment_type])
      .map(mapPayment),
    timeline: (row.order_status_history ?? [])
      .slice()
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map(mapTimeline),
    deliveryAddress: mapAddress(row.addresses),
  };
}
