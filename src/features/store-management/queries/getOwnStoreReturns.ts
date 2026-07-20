/**
 * getOwnStoreReturns — Phase 04 / T07 (FR-SEL-6). Reads the caller's OWN
 * `return_policy` TEXT for the /seller/store/returns page.
 *
 * Same identity-dependent, self-scope-RLS read pattern as `getOwnStore` (T06)
 * — see that file for the full rationale.
 *
 * Returns `null` when the caller has no store yet (defensive — profile +
 * store are written atomically at submit per ADR-012).
 */

import { createClient } from "@/lib/supabase/server";
import type { StoreManagementClient } from "./getOwnStore";

export interface OwnStoreReturns {
  id: string;
  returnPolicy: string | null;
}

export async function getOwnStoreReturns(
  client?: StoreManagementClient,
): Promise<OwnStoreReturns | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id, return_policy")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[store-management] getOwnStoreReturns read failed: ${error.message}`);
  }
  if (!data) return null;

  return { id: data.id, returnPolicy: data.return_policy };
}
