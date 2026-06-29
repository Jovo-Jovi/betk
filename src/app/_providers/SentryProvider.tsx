"use client";

/**
 * SentryProvider — client-side Sentry user context.
 *
 * Sentry.init() is handled by instrumentation-client.ts (T09 finding fix).
 * This component is a "use client" boundary that calls Sentry.setUser({ id })
 * once the GoTrue session is resolved — without making the Server Component
 * layout a Client Component.
 *
 * ENTRY DEBT 2 (T02): resolved here. Sentry.setUser is called with only the
 * user id (no PII — no phone, no name, no email). The id is the Supabase UUID
 * (no personal meaning on its own).
 *
 * No-PII rule: ONLY `id` is set. Never set `email`, `username`, `ip_address`,
 * or any free-text field.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { createBrowserClient } from "@supabase/ssr";

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Get the current session once on mount to set Sentry user context.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        Sentry.setUser({ id: user.id });
      } else {
        Sentry.setUser(null);
      }
    });

    // Subscribe to subsequent auth state changes (sign-in / sign-out).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          Sentry.setUser({ id: session.user.id });
        } else {
          Sentry.setUser(null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
