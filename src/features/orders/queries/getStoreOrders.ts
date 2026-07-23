/**
 * getStoreOrders — the SELLER order list (`/seller/orders`, T06). Phase 07 / T02b.
 *
 * Seller scope: resolves the caller's OWN store id and pins `store_id = self`
 * (belt & suspenders on top of the orders_access store branch). Newest first.
 * Empty list when the caller has no session or no store.
 *
 * `depositStatus` on each row powers the accept gate (a seller may accept only
 * after the deposit is admin-confirmed — AC-SEL-14). `buyerName` is null under the
 * current RLS (REG-44 FLAGGED — see types.ts).
 */

import { createClient } from "@/lib/supabase/server";
import type { OrderSummary } from "../types";
import type { OrderStatusFilter } from "@/validations/orders";
import { SUMMARY_SELECT, mapSummary, type RawSummaryRow } from "./_mappers";
import { resolveCallerScope, type OrdersClient } from "./_shared";

export async function getStoreOrders(
  statusFilter: OrderStatusFilter = "all",
  client?: OrdersClient,
): Promise<OrderSummary[]> {
  const supabase = client ?? (await createClient());
  const scope = await resolveCallerScope(supabase);
  if (!scope || scope.storeId === null) return [];

  let query = supabase
    .schema("betk")
    .from("orders")
    .select(SUMMARY_SELECT)
    .eq("store_id", scope.storeId);
  if (statusFilter !== "all") query = query.eq("status", statusFilter);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`[orders] getStoreOrders failed: ${error.message}`);

  const rows = (data ?? []) as unknown as RawSummaryRow[];
  return rows.map(mapSummary);
}
