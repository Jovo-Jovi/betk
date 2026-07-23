/**
 * Orders feature — shared client type + caller resolution. Phase 07 / T02b.
 *
 * NOT server-only: imported by query files AND the Server Actions (cookie client)
 * AND integration tests (injected authenticated client). Narrow surface so both
 * the ssr cookie client and the plain client satisfy it (MessagingClient precedent).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type OrdersClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

/** The caller's GoTrue uid + their OWN store id (null when not a seller w/ store). */
export interface CallerScope {
  userId: string;
  storeId: string | null;
}

/** The current GoTrue uid, or null when there is no session. */
export async function resolveCallerUserId(supabase: OrdersClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Resolve the caller's uid + own store id from the live session. Seller order
 * surfaces + acceptOrder/markOrderPreparing pin to this (belt & suspenders on top
 * of the RLS store-scope policies). Returns null when there is no session.
 */
export async function resolveCallerScope(supabase: OrdersClient): Promise<CallerScope | null> {
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id")
    .eq("seller_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[orders] resolveCallerScope failed: ${error.message}`);
  }
  return { userId, storeId: data?.id ?? null };
}
