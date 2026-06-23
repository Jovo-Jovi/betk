"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { POSTHOG_CONFIG } from "@/services/posthog";

/**
 * Initialises the PostHog browser SDK and wraps children in the React context.
 * Must be a "use client" leaf so the Server Component layout stays a pure RSC.
 *
 * No-PII guarantee: autocapture disabled; only user.id passed to identify().
 * Only inits when NEXT_PUBLIC_POSTHOG_KEY is set — safe to omit in local dev.
 */
if (typeof window !== "undefined" && POSTHOG_CONFIG.key) {
  posthog.init(POSTHOG_CONFIG.key, {
    api_host: POSTHOG_CONFIG.host,
    autocapture: POSTHOG_CONFIG.autocapture,
    capture_pageview: POSTHOG_CONFIG.capture_pageview,
    person_profiles: POSTHOG_CONFIG.person_profiles,
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_CONFIG.key) {
    return <>{children}</>;
  }
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
