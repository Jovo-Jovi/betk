/**
 * getOwnAddresses — the caller's saved delivery addresses (`addr_self`).
 *
 * Default-first ordering (`is_default DESC, created_at DESC`) so a saved
 * default is first (R-P66-DEST). Returns `[]` for an unauthenticated caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type AddressReader = Pick<SupabaseClient<Database>, "schema" | "auth">;

export interface AddressListItem {
  id: string;
  label: string | null;
  governorate: string;
  city: string;
  streetAddress: string;
  buildingNotes: string | null;
  isDefault: boolean;
}

interface RawAddressRow {
  id: string;
  label: string | null;
  governorate: string;
  city: string;
  street_address: string;
  building_notes: string | null;
  is_default: boolean;
}

export async function getOwnAddresses(client?: AddressReader): Promise<AddressListItem[]> {
  const supabase = client ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .schema("betk")
    .from("addresses")
    .select("id, label, governorate, city, street_address, building_notes, is_default")
    .eq("buyer_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`[buyer-account] getOwnAddresses failed: ${error.message}`);
  }

  return ((data ?? []) as unknown as RawAddressRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    governorate: row.governorate,
    city: row.city,
    streetAddress: row.street_address,
    buildingNotes: row.building_notes,
    isDefault: row.is_default,
  }));
}
