"use client";

/**
 * SentryProvider — layout host for future client-side Sentry context.
 *
 * Sentry.init() is now handled by instrumentation-client.ts (T09 finding fix).
 * This component is kept as a "use client" boundary so Phase 02 (auth) can
 * call Sentry.setUser({ id }) here after the user session is resolved — without
 * making the Server Component layout a Client Component.
 *
 * TODO(Phase 02): inject the authenticated user id via Sentry.setUser().
 */
export function SentryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
