/**
 * One statement that leaves a single default on the buyer's own addresses.
 *
 * `betk.addresses.is_default` is `BOOLEAN NOT NULL DEFAULT false` and has no
 * unique constraint (`supabase/migrations/20260622082812_user_seller_store.sql`
 * line 34). The only address index is `idx_addresses_buyer`
 * (`supabase/migrations/20260622083052_indexes.sql` line 19). Live
 * `pg_constraint` on this table is the primary key and `addresses_buyer_id_fkey`
 * only (read 2026-10-09).
 *
 * PostgREST PATCH assigns one literal to every matched row, so "clear the
 * others, then set this one" would be two writes. This function issues one
 * upsert. Postgres runs it as one `INSERT ... ON CONFLICT (id) DO UPDATE`.
 * `is_default` is true on the chosen id and false on every other row owned by
 * this buyer in that statement. The cookie client is the caller, so `addr_self`
 * (`buyer_id = auth.uid() OR betk.is_admin()`) is the write boundary.
 */

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type CookieClient = Awaited<ReturnType<typeof createClient>>;

export interface AddressFieldPatch {
  label: string | null;
  governorate: string;
  city: string;
  street_address: string;
  building_notes: string | null;
}

type AddressRow = Pick<
  Database["betk"]["Tables"]["addresses"]["Row"],
  | "id"
  | "buyer_id"
  | "label"
  | "governorate"
  | "city"
  | "street_address"
  | "building_notes"
>;

export type AssignDefaultResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "error" };

export async function assignSingleDefault(
  supabase: CookieClient,
  buyerId: string,
  addressId: string,
  patch?: AddressFieldPatch,
): Promise<AssignDefaultResult> {
  const read = await supabase
    .schema("betk")
    .from("addresses")
    .select("id, buyer_id, label, governorate, city, street_address, building_notes")
    .eq("buyer_id", buyerId);

  if (read.error) return { ok: false, reason: "error" };

  const rows = (read.data ?? []) as AddressRow[];
  if (!rows.some((row) => row.id === addressId)) {
    return { ok: false, reason: "not_found" };
  }

  const write = await supabase
    .schema("betk")
    .from("addresses")
    .upsert(
      rows.map((row) => {
        const chosen = row.id === addressId;
        const fields = chosen && patch ? patch : row;
        return {
          id: row.id,
          buyer_id: row.buyer_id,
          label: fields.label,
          governorate: fields.governorate,
          city: fields.city,
          street_address: fields.street_address,
          building_notes: fields.building_notes,
          is_default: chosen,
        };
      }),
      { onConflict: "id" },
    );

  if (write.error) return { ok: false, reason: "error" };
  return { ok: true };
}
