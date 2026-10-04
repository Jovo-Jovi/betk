/**
 * Guest cart insert attempt (R-C01, AC-CART-1).
 *
 * Runs on the caller's client. A guest is the anon role: INSERT on
 * betk.cart_items is revoked, and cart_items_insert requires
 * buyer_id = auth.uid(). This function does not use the service role and
 * does not delete. A returned row id means a row was written.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Not a user. The insert is refused before a row exists. */
const GUEST_BUYER_ID = "00000000-0000-0000-0000-000000000000";

export interface GuestCartAttempt {
  errorCode: string | null;
  rowId: string | null;
}

type CartClient = Pick<SupabaseClient<Database>, "schema">;

export async function attemptGuestCartInsert(
  client: CartClient,
  listingId: string,
): Promise<GuestCartAttempt> {
  const { data, error } = await client
    .schema("betk")
    .from("cart_items")
    .insert({
      buyer_id: GUEST_BUYER_ID,
      listing_id: listingId,
      quantity: 1,
      unit_price: 1,
      is_custom: false,
    })
    .select("id")
    .maybeSingle();

  return {
    errorCode: error?.code ?? null,
    rowId: data?.id ?? null,
  };
}
