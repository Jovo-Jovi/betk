/**
 * PostHog browser config — client-safe exports only.
 *
 * This file is imported by app/_providers/PostHogProvider.tsx ("use client"),
 * so it MUST contain no server-only imports and MUST NOT reference posthog-node.
 * webpack bundles every require() it can statically see — even inside functions —
 * so posthog-node (which pulls in node:fs, node:readline) must live in a
 * completely separate module: @/services/posthog.server.
 *
 * No-PII policy:
 *   ✓  user.id (Supabase UUID — no personal meaning)
 *   ✗  email, phone_number, display_name, IP, or any free-text PII
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
