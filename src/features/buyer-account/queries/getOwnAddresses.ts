/**
 * getOwnAddresses — the caller's saved delivery addresses (`addr_self` RLS,
 * own/admin). Minimal read needed by CHECKOUT's select-or-create flow (T03) —
 * NOT the full `/account/addresses` Address Book (UI_SPEC §4.2, still unbuilt).
 *
 * Default-first ordering (`is_default DESC, created_at DESC`) so a saved default
 * address is pre-selected. Returns `[]` for an unauthenticated caller (never
 * throws on that — the page decides what to do with an empty list).
 */

import { createClient } from "@/lib/supabase/server";
import type { BuyerAccountClient } from "./_shared";

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

export async function getOwnAddresses(client?: BuyerAccountClient): Promise<AddressListItem[]> {
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

  return ((data ?? []) as unknown as RawAddressRow[]).map((r) => ({
    id: r.id,
    label: r.label,
    governorate: r.governorate,
    city: r.city,
    streetAddress: r.street_address,
    buildingNotes: r.building_notes,
    isDefault: r.is_default,
  }));
}
