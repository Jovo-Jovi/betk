/**
 * getOwnStorePayments — Phase 04 / T07 (FR-SEL-7 / R-S09 config). Reads the
 * caller's OWN `payment_methods` JSONB for the /seller/store/payments page.
 *
 * Same identity-dependent, self-scope-RLS read pattern as `getOwnStore` (T06)
 * — see that file for the full rationale.
 *
 * Returns `null` when the caller has no store yet (defensive — profile +
 * store are written atomically at submit per ADR-012).
 */

import { getTyped, type StorePaymentMethods } from "@/types/jsonb";
import { createClient } from "@/lib/supabase/server";
import type { StoreManagementClient } from "./getOwnStore";

export interface OwnStorePayments {
  id: string;
  paymentMethods: StorePaymentMethods;
}

export async function getOwnStorePayments(
  client?: StoreManagementClient,
): Promise<OwnStorePayments | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id, payment_methods")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[store-management] getOwnStorePayments read failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    paymentMethods: getTyped<StorePaymentMethods>(data.payment_methods),
  };
}
