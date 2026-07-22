/**
 * Listings feature — shared client type + own-store resolution. Phase 05 / T02.
 *
 * NOT server-only: imported by query files AND the Server Actions (which run
 * under the cookie client) AND integration tests (which inject an authenticated
 * per-user client). `.schema()`/`.auth` are the only surfaces used, kept narrow
 * so the ssr cookie client and the plain supabase-js client both satisfy it
 * (the `DiscoveryClient` precedent, see discovery/queries/_shared.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ListingsClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

/** Default page size for the Listings Management table (T03). */
export const OWN_LISTINGS_PAGE_SIZE = 20;

/**
 * Resolves the caller's OWN store id from the live GoTrue session, or null when
 * there is no session / the caller has no store (not a seller). Every seller-
 * scoped listings read/write pins queries to this id (belt & suspenders on top
 * of the `listings_seller` / `listings_public` own-store RLS branches).
 */
export async function resolveCallerStoreId(
  supabase: ListingsClient,
): Promise<{ userId: string; storeId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[listings] resolveCallerStoreId failed: ${error.message}`);
  }
  if (!data) return null;
  return { userId: user.id, storeId: data.id };
}
