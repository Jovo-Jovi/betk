/**
 * getOwnStorePickup — P27. The seller's own pickup row plus the store's
 * public governorate. Does not read `stores.delivery_options`.
 */

import { createClient } from "@/lib/supabase/server";
import type { StoreManagementClient } from "./getOwnStore";

export interface OwnStorePickup {
  id: string;
  governorate: string;
  city: string | null;
  pickup: {
    governorate: string;
    city: string;
    streetAddress: string;
    buildingNotes: string | null;
  } | null;
}

export async function getOwnStorePickup(
  client?: StoreManagementClient,
): Promise<OwnStorePickup | null> {
  const supabase = client ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: store, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id, governorate, city")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[store-management] getOwnStorePickup read failed: ${error.message}`);
  }
  if (!store) return null;

  const { data: pickup, error: pickupError } = await supabase
    .schema("betk")
    .from("store_pickup_addresses")
    .select("governorate, city, street_address, building_notes")
    .eq("store_id", store.id)
    .maybeSingle();

  if (pickupError) {
    throw new Error(`[store-management] getOwnStorePickup address read failed: ${pickupError.message}`);
  }

  return {
    id: store.id,
    governorate: store.governorate,
    city: store.city,
    pickup: pickup
      ? {
          governorate: pickup.governorate,
          city: pickup.city,
          streetAddress: pickup.street_address,
          buildingNotes: pickup.building_notes,
        }
      : null,
  };
}
