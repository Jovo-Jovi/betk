import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cookie-bound Supabase client for Server Components, Server Actions, and
 * Route Handlers.  Reads the authenticated user's session from the request
 * cookie jar so RLS policies see the correct `auth.uid()`.
 *
 * Must be called inside a Next.js server context (RSC render, Server Action,
 * or Route Handler) where `next/headers` is available.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` may be called from a Server Component where the cookie
            // store is read-only.  Mutations from Middleware or Route Handlers
            // will succeed; this is a no-op for read-only renders.
          }
        },
      },
    },
  );
}
