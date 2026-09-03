/**
 * getStoreOrderDetail — a single SELLER order (`/seller/orders/[id]`, T06). Phase
 * 07 / T02b.
 *
 * Seller-scoped: pinned to the caller's OWN `store_id` (a buyer reading via
 * orders_access is filtered out → null → T06 notFound()). Items, the two payment
 * rows (incl. the deposit state for the accept gate), and the REAL status-history
 * timeline populate via the parent-scoped embeds.
 *
 * REG-44 (FLAGGED): `buyerName` + `deliveryAddress` are null here — the seller has
 * NO RLS read path to buyer_profiles/addresses (`bp_self`/`addr_self` = own/admin
 * only) and T02b authorized no seller-read broadening or order snapshot. The
 * fulfilment data-access mechanism is a human-authorized decision, owed. See
 * types.ts.
 */

import { createClient } from "@/lib/supabase/server";
import type { OrderDetail } from "../types";
import { DETAIL_SELECT, mapDetail, type RawDetailRow } from "./_mappers";
import { resolveCallerScope, type OrdersClient } from "./_shared";

export async function getStoreOrderDetail(
  orderId: string,
  client?: OrdersClient,
): Promise<OrderDetail | null> {
  const supabase = client ?? (await createClient());
  const scope = await resolveCallerScope(supabase);
  if (!scope || scope.storeId === null) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", orderId)
    .eq("store_id", scope.storeId)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`[orders] getStoreOrderDetail failed: ${error.message}`);
  }
  if (!data) return null;

  return mapDetail(data as unknown as RawDetailRow);
}
