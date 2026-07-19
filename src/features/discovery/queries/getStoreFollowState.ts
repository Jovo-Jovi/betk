/**
 * getStoreFollowState — Phase 03 / T06 (FR-PUB-5). Reads whether a given buyer
 * currently follows a store, for the storefront FollowButton's initial state.
 *
 * Identity-dependent read (NOT a public anon read): runs under the caller's own
 * auth context via the cookie client, subject to the `store_follows` self-scope
 * SELECT policy (sf_select_self — `buyer_id = auth.uid() OR betk.is_admin()`,
 * REG-29). The `buyer_id` is resolved by the RSC page from the live GoTrue
 * session and passed in; a guest (`null`) short-circuits to `false` with no
 * query. Filtering by `buyer_id` explicitly (not relying on RLS alone) keeps
 * the result correct even for an admin viewer whose SELECT sees ALL rows — and
 * a non-owner still can't read another buyer's follow row (RLS returns nothing
 * when `buyer_id != auth.uid()`).
 *
 * State reads stay in the query layer (the toggle mutation lives in the
 * `toggleFollow` Server Action); this read is deliberately NOT in the anon
 * discovery read layer because it depends on the caller's identity.
 */

import { createClient } from "@/lib/supabase/server";
import type { DiscoveryClient } from "./_shared";

/**
 * @param storeId  the store whose follow state to check.
 * @param buyerId  the authenticated buyer id (from the live GoTrue session), or
 *                 `null` for a guest (→ `false`, no query).
 * @param client   Supabase client override (integration tests inject an
 *                 authenticated per-buyer client; RSC callers omit this and get
 *                 the cookie client).
 */
export async function getStoreFollowState(
  storeId: string,
  buyerId: string | null,
  client?: DiscoveryClient,
): Promise<boolean> {
  if (!buyerId) return false;
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("store_follows")
    .select("id")
    .eq("store_id", storeId)
    .eq("buyer_id", buyerId)
    .limit(1);

  if (error) {
    throw new Error(`[discovery] getStoreFollowState failed: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}
