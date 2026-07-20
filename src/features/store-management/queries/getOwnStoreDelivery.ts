/**
 * getOwnStoreDelivery — Phase 04 / T07 (FR-SEL-5). Reads the caller's OWN
 * `delivery_options` JSONB for the /seller/store/delivery page.
 *
 * Same identity-dependent, self-scope-RLS read pattern as `getOwnStore` (T06):
 * runs under the caller's own auth context (cookie client in RSC; an
 * authenticated per-user client injected in tests), `stores_public`'s
 * `seller_id = auth.uid()` branch exposes the row even while not `active`.
 * The uid is resolved from the live GoTrue session AND pinned into the
 * filter explicitly (not RLS alone).
 *
 * Returns `null` when the caller has no store yet (defensive — profile +
 * store are written atomically at submit per ADR-012).
 */

import { getTyped, type StoreDeliveryOptions } from "@/types/jsonb";
import { createClient } from "@/lib/supabase/server";
import type { StoreManagementClient } from "./getOwnStore";

export interface OwnStoreDelivery {
  id: string;
  deliveryOptions: StoreDeliveryOptions;
}

export async function getOwnStoreDelivery(
  client?: StoreManagementClient,
): Promise<OwnStoreDelivery | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id, delivery_options")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[store-management] getOwnStoreDelivery read failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    deliveryOptions: getTyped<StoreDeliveryOptions>(data.delivery_options),
  };
}
