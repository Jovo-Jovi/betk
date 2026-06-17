// SERVER-ONLY — bypasses RLS; never import in client code.
// Re-implement ownership checks explicitly in every code path that uses this client.

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/configs/env";
import type { Database } from "./types";

/**
 * Service-role Supabase client — bypasses Row Level Security.
 *
 * Use ONLY in trusted server contexts:
 *   • Background jobs / cron handlers
 *   • Admin-only Server Actions that have already verified `is_admin()`
 *   • Webhooks from trusted sources
 *
 * Every caller MUST re-check ownership/role in application code because RLS
 * is disabled for this client.  Do not expose this client or its result in
 * a response without an explicit authorization check.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
