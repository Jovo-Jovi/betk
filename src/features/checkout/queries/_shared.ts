/**
 * Checkout feature — shared client type + caller resolution. Phase 07 / T02b.
 *
 * NOT server-only: imported by the query file AND the Server Actions (cookie
 * client) AND integration tests (which inject an authenticated per-user
 * supabase-js client). Only `.schema()`/`.auth`/`.rpc` are used, kept narrow so
 * the ssr cookie client and the plain client both satisfy it (the MessagingClient
 * precedent).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type CheckoutClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

/** The current GoTrue uid, or null when there is no session. */
export async function resolveCallerUserId(supabase: CheckoutClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
