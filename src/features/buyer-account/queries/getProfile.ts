/**
 * getProfile — load the authenticated user's buyer_profiles + users row.
 *
 * Called from the /account RSC page. Uses the authenticated cookie client so
 * both queries run under the caller's RLS context:
 *   - buyer_profiles: bp_self (FOR ALL USING id = auth.uid()) — covers SELECT.
 *   - users: users_self (FOR SELECT USING id = auth.uid()).
 *
 * Returns null for either if the row doesn't exist (shouldn't happen for an
 * active buyer, but we handle it defensively).
 *
 * Phase 02 / T05.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type BuyerProfileRow =
  Database["betk"]["Tables"]["buyer_profiles"]["Row"];
export type UsersRow = Database["betk"]["Tables"]["users"]["Row"];

export interface ProfileData {
  buyerProfile: BuyerProfileRow;
  user: UsersRow;
}

/**
 * Fetch buyer_profiles + users for the currently authenticated user.
 * Returns null when the session is absent or either row is missing.
 */
export async function getProfile(): Promise<ProfileData | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const [bpResult, userResult] = await Promise.all([
    supabase
      .schema("betk")
      .from("buyer_profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle(),
    supabase
      .schema("betk")
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle(),
  ]);

  if (!bpResult.data || !userResult.data) return null;

  return {
    buyerProfile: bpResult.data,
    user: userResult.data,
  };
}
