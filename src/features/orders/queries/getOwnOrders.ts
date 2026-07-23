/**
 * getOwnOrders — the BUYER order list (`/orders`, T04). Phase 07 / T02b.
 *
 * Buyer scope: pinned to `buyer_id = self` on top of the `orders_access` SELECT
 * branch (buyer OR store OR admin) so only the caller's OWN buyer-side orders
 * surface. Newest first (created_at DESC). Empty list when there is no session.
 *
 * `statusFilter` powers the T04 status tabs; 'all' (default) applies no filter.
 */

import { createClient } from "@/lib/supabase/server";
import type { OrderSummary } from "../types";
import type { OrderStatusFilter } from "@/validations/orders";
import { SUMMARY_SELECT, mapSummary, type RawSummaryRow } from "./_mappers";
import { resolveCallerUserId, type OrdersClient } from "./_shared";

export async function getOwnOrders(
  statusFilter: OrderStatusFilter = "all",
  client?: OrdersClient,
): Promise<OrderSummary[]> {
  const supabase = client ?? (await createClient());
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return [];

  let query = supabase
    .schema("betk")
    .from("orders")
    .select(SUMMARY_SELECT)
    .eq("buyer_id", userId);
  if (statusFilter !== "all") query = query.eq("status", statusFilter);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`[orders] getOwnOrders failed: ${error.message}`);

  const rows = (data ?? []) as unknown as RawSummaryRow[];
  return rows.map(mapSummary);
}
