import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Stateless anon Supabase client — no cookies, no session, anon key only.
 * RLS still fully applies (same guest/anon role as the cookie-bound client).
 *
 * Use ONLY for public, non-personalized reads that need to run OUTSIDE a
 * per-request cookie context — e.g. inside `unstable_cache`/ISR-revalidated
 * pages, where Next.js forbids calling `cookies()`/`headers()` (the cookie-
 * bound `createClient()` in `./server.ts` calls `cookies()` internally, which
 * would force the whole route into per-request dynamic rendering and defeat
 * time-based revalidation). Mirrors the plain anon client integration tests
 * already use for this exact query layer (`tests/integration/discovery.
 * queries.test.ts`) — see `src/features/discovery/queries/_shared.ts`'s
 * `DiscoveryClient` type, designed to accept either client interchangeably.
 *
 * Never use this where the caller's identity matters (wishlist/follow
 * membership, order ownership, etc.) — those must stay on the cookie client.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
