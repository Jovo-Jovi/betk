/**
 * P66 cart read. Cookie client only. RLS is the boundary.
 *
 * Dropped prompts (R-DROPPED) are derived here. No new table, column, or write.
 * Cancellation time is order_status_history.created_at where to_status is
 * 'cancelled'. The buyer can read that column: policy
 * order_status_history_access joins seller_orders on order_id and allows
 * buyer_id = auth.uid() (live pg_policy, 2026-10-06). authenticated has
 * SELECT on created_at. A history error is a page error. It is never
 * re-read with the service role.
 *
 * quote_validity_hours is not granted to the buyer. readQuoteValidityHours
 * reads that one key and fails closed. There is no numeric fallback.
 *
 * seller_orders is selected by explicit columns (no star): id and status.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { captureTaggedError } from "@/services/sentry";
import { readQuoteValidityHours } from "@/services/quoteValidityHours";
import {
  asAmount,
  deriveCartBlock,
  firstEmbed,
  selectDroppedPrompts,
  type DroppedInquiry,
} from "@/features/cart/cartRules";
import type { CartPageLine, DroppedQuotePrompt } from "@/features/cart/types";

const CART_SELECT = `
  id, quantity, unit_price, is_custom, inquiry_id, created_at,
  listings (
    title_ar, title_en, stock_qty, status, deleted_at,
    stores ( name_ar, name_en, status )
  ),
  inquiries ( quote_expires_at, status )
`;

const CANCELLED_ORDERS_SELECT = `
  id, status,
  order_items (
    inquiry_id, is_custom, listing_id, listing_title_ar, unit_price, quantity,
    listings ( title_ar, title_en, stores ( name_ar, name_en, status ) )
  ),
  order_status_history ( created_at, to_status )
`;

export type CartPageData =
  | { ok: true; lines: CartPageLine[]; dropped: DroppedQuotePrompt[] }
  | { ok: false };

interface NameFallbacks {
  listing: string;
  store: string;
}

interface RawStore {
  name_ar: string;
  name_en: string | null;
  status: string;
}

interface RawListing {
  title_ar: string;
  title_en: string | null;
  stock_qty: number | string | null;
  status: string;
  deleted_at: string | null;
  stores: RawStore | RawStore[] | null;
}

interface RawCartRow {
  id: string;
  quantity: number | string;
  unit_price: number | string;
  is_custom: boolean;
  inquiry_id: string | null;
  listings: RawListing | RawListing[] | null;
  inquiries:
    | { quote_expires_at: string | null; status: string }
    | { quote_expires_at: string | null; status: string }[]
    | null;
}

interface RawOrderItem {
  inquiry_id: string | null;
  is_custom: boolean;
  listing_id: string;
  listing_title_ar: string;
  unit_price: number | string;
  quantity: number | string;
  listings: RawListing | RawListing[] | null;
}

interface RawHistory {
  created_at: string;
  to_status: string;
}

interface RawCancelledOrder {
  id: string;
  status: string;
  order_items: RawOrderItem | RawOrderItem[] | null;
  order_status_history: RawHistory | RawHistory[] | null;
}

interface RawInquiry {
  id: string;
  quote_expires_at: string | null;
  status: string;
}

function asList<T>(value: T | readonly T[] | null | undefined): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return [...value];
  return [value as T];
}

function displayName(
  ar: string | null | undefined,
  en: string | null | undefined,
  locale: AppLocale,
  fallback: string,
): string {
  const name = localizedName({ ar, en }, locale);
  return name || fallback;
}

function mapLine(row: RawCartRow, locale: AppLocale, fallbacks: NameFallbacks, now: Date): CartPageLine {
  const listing = firstEmbed(row.listings);
  const store = listing ? firstEmbed(listing.stores) : null;
  const inquiry = firstEmbed(row.inquiries);
  const quantity = asAmount(row.quantity);
  const block = deriveCartBlock(
    {
      isCustom: row.is_custom,
      quantity,
      quoteExpiresAt: inquiry?.quote_expires_at ?? null,
      inquiryPresent: row.inquiry_id != null && inquiry != null,
      listing: listing
        ? {
            status: listing.status,
            deletedAt: listing.deleted_at,
            stockQty: listing.stock_qty == null ? null : asAmount(listing.stock_qty),
          }
        : null,
      storeStatus: store?.status ?? null,
    },
    now,
  );

  return {
    lineId: row.id,
    title: listing
      ? displayName(listing.title_ar, listing.title_en, locale, fallbacks.listing)
      : fallbacks.listing,
    unitPrice: asAmount(row.unit_price),
    quantity,
    isCustom: row.is_custom,
    stockQty: listing?.stock_qty == null ? null : asAmount(listing.stock_qty),
    quoteExpiresAt: inquiry?.quote_expires_at ?? null,
    inquiryId: row.inquiry_id,
    storeName: store
      ? displayName(store.name_ar, store.name_en, locale, fallbacks.store)
      : fallbacks.store,
    blockedReason: block.blockedReason,
    stockLabel: block.stockLabel,
  };
}

interface GroupedItem {
  titleAr: string;
  titleEn: string | null;
  storeAr: string | null;
  storeEn: string | null;
  unitPrice: number;
  quantity: number;
  cancelledAts: string[];
}

function groupCustomItems(orders: RawCancelledOrder[]): Map<string, GroupedItem> {
  const grouped = new Map<string, GroupedItem>();
  for (const order of orders) {
    if (order.status !== "cancelled") continue;
    const times = asList(order.order_status_history)
      .filter((row) => row.to_status === "cancelled")
      .map((row) => row.created_at);
    for (const item of asList(order.order_items)) {
      if (!item.is_custom || !item.inquiry_id) continue;
      const listing = firstEmbed(item.listings);
      const store = listing ? firstEmbed(listing.stores) : null;
      const existing = grouped.get(item.inquiry_id);
      if (existing) {
        existing.cancelledAts.push(...times);
        continue;
      }
      grouped.set(item.inquiry_id, {
        titleAr: listing?.title_ar || item.listing_title_ar,
        titleEn: listing?.title_en ?? null,
        storeAr: store?.name_ar ?? null,
        storeEn: store?.name_en ?? null,
        unitPrice: asAmount(item.unit_price),
        quantity: asAmount(item.quantity),
        cancelledAts: [...times],
      });
    }
  }
  return grouped;
}

export async function getCartPage(locale: AppLocale, fallbacks: NameFallbacks): Promise<CartPageData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { data, error } = await supabase
      .schema("betk")
      .from("cart_items")
      .select(CART_SELECT)
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      captureTaggedError(error, "discovery", { extra: { step: "getCartPage.lines" } });
      return { ok: false };
    }

    const now = new Date();
    const lines = ((data ?? []) as unknown as RawCartRow[]).map((row) =>
      mapLine(row, locale, fallbacks, now),
    );

    const hours = await readQuoteValidityHours();
    if (hours == null) return { ok: true, lines, dropped: [] };

    const { data: orders, error: ordersError } = await supabase
      .schema("betk")
      .from("seller_orders")
      .select(CANCELLED_ORDERS_SELECT)
      .eq("buyer_id", user.id)
      .eq("status", "cancelled");

    if (ordersError) {
      captureTaggedError(ordersError, "discovery", { extra: { step: "getCartPage.cancelled" } });
      return { ok: false };
    }

    const grouped = groupCustomItems((orders ?? []) as unknown as RawCancelledOrder[]);
    const inquiryIds = [...grouped.keys()];
    if (inquiryIds.length === 0) return { ok: true, lines, dropped: [] };

    const { data: inquiries, error: inquiryError } = await supabase
      .schema("betk")
      .from("inquiries")
      .select("id, quote_expires_at, status")
      .in("id", inquiryIds)
      .eq("buyer_id", user.id);

    if (inquiryError) {
      captureTaggedError(inquiryError, "discovery", { extra: { step: "getCartPage.inquiries" } });
      return { ok: false };
    }

    const cartInquiryIds = new Set(
      lines.map((line) => line.inquiryId).filter((id): id is string => id != null),
    );
    const candidates: DroppedInquiry[] = ((inquiries ?? []) as unknown as RawInquiry[]).flatMap(
      (inquiry) => {
        const item = grouped.get(inquiry.id);
        if (!item) return [];
        return [
          {
            inquiryId: inquiry.id,
            quoteExpiresAt: inquiry.quote_expires_at,
            status: inquiry.status,
            hasCartLine: cartInquiryIds.has(inquiry.id),
            cancelledAts: item.cancelledAts,
          },
        ];
      },
    );

    const dropped: DroppedQuotePrompt[] = selectDroppedPrompts(candidates, now, hours).flatMap(
      (prompt) => {
        const item = grouped.get(prompt.inquiryId);
        if (!item) return [];
        return [
          {
            inquiryId: prompt.inquiryId,
            title: displayName(item.titleAr, item.titleEn, locale, fallbacks.listing),
            storeName: displayName(item.storeAr, item.storeEn, locale, fallbacks.store),
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          },
        ];
      },
    );

    return { ok: true, lines, dropped };
  } catch (err) {
    captureTaggedError(err, "discovery", { extra: { step: "getCartPage" } });
    return { ok: false };
  }
}
