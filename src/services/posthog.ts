/**
 * PostHog service — init config for the client provider.
 *
 * No-PII policy (enforced everywhere posthog.identify is called):
 *   ✓  user.id (Supabase UUID — no personal meaning)
 *   ✗  email, phone_number, display_name, IP, or any free-text PII
 *
 * The browser singleton is initialised by app/_providers/PostHogProvider.tsx.
 * Server-side event capture uses posthog-node (wired in T11).
 */

export const POSTHOG_CONFIG = {
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
  /** Disable autocapture to avoid unintentional PII collection. */
  autocapture: false,
  /** Manual pageview tracking only — called per route change. */
  capture_pageview: false,
  /** Only create person profiles for explicitly identified users. */
  person_profiles: "identified_only" as const,
} as const;
