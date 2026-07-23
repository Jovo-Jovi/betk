/**
 * getOrderDetail — a single BUYER order (`/orders/[id]`, T04). Phase 07 / T02b.
 *
 * Buyer-scoped: pinned to `buyer_id = self` (a seller who can READ the row via
 * orders_access store-scope is not the buyer → null → T04 notFound()). The buyer's
 * OWN delivery address populates via `addr_self`; the two payment rows, items, and
 * the REAL order_status_history timeline come from the parent-scoped embeds.
 * Malformed/unknown id or a foreign order → **null**.
 */

import { createClient } from "@/lib/supabase/server";
import type { OrderDetail } from "../types";
import { DETAIL_SELECT, mapDetail, type RawDetailRow } from "./_mappers";
import { resolveCallerUserId, type OrdersClient } from "./_shared";

export async function getOrderDetail(
  orderId: string,
  client?: OrdersClient,
): Promise<OrderDetail | null> {
  const supabase = client ?? (await createClient());
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`[orders] getOrderDetail failed: ${error.message}`);
  }
  if (!data) return null;

  return mapDetail(data as unknown as RawDetailRow);
}
