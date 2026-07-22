/**
 * Messaging feature — shared client type + caller resolution. Phase 06 / T02.
 *
 * NOT server-only: imported by query files AND the Server Actions (cookie
 * client) AND integration tests (which inject an authenticated per-user
 * supabase-js client). `.schema()`/`.auth` are the only surfaces used, kept
 * narrow so both the ssr cookie client and the plain client satisfy it (the
 * `ListingsClient`/`DiscoveryClient` precedent).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type MessagingClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

/** The caller's GoTrue uid + their OWN store id (null when not a seller w/ store). */
export interface CallerScope {
  userId: string;
  storeId: string | null;
}

/** The current GoTrue uid, or null when there is no session. */
export async function resolveCallerUserId(supabase: MessagingClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Resolves the caller's uid + own store id from the live session. Every
 * participation check pins to this (belt & suspenders on top of the T01 RLS
 * thread-scope policies). Returns null when there is no session.
 */
export async function resolveCallerScope(supabase: MessagingClient): Promise<CallerScope | null> {
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select("id")
    .eq("seller_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[messaging] resolveCallerScope failed: ${error.message}`);
  }
  return { userId, storeId: data?.id ?? null };
}
