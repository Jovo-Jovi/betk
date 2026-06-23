/**
 * PostHog service — client config + server-side capture helpers.
 *
 * No-PII policy (enforced everywhere):
 *   ✓  user.id (Supabase UUID — no personal meaning)
 *   ✗  email, phone_number, display_name, IP, or any free-text PII
 *
 * Layout:
 *   POSTHOG_CONFIG      — consumed by app/_providers/PostHogProvider.tsx (browser)
 *   captureServerEvent  — posthog-node server-side capture (Server Actions / RSC)
 *   identifyUser        — associate server events with the Supabase user id
 *
 * NOTE: This file is imported by PostHogProvider.tsx ("use client"), so it MUST
 * NOT import "server-only" or statically import "posthog-node" at module level.
 * Server functions use a lazy runtime require() that is unreachable in the browser.
 */

// ---------------------------------------------------------------------------
// Browser config (T09 — unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Server-side capture (posthog-node) — Node.js runtime only
// ---------------------------------------------------------------------------

/**
 * Minimal type surface needed from posthog-node to avoid a top-level import.
 * The real PostHog class satisfies this shape.
 */
interface PostHogNodeClient {
  capture(params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void;
  identify(params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void;
}

let _nodeClient: PostHogNodeClient | null = null;

/**
 * Returns the posthog-node singleton, or null when:
 *  • called from the browser (window exists)
 *  • NEXT_PUBLIC_POSTHOG_KEY is not configured
 *  • posthog-node is unavailable (should never happen — it's a listed dep)
 *
 * Uses runtime require() so Next.js does NOT bundle posthog-node for the client.
 */
function getNodeClient(): PostHogNodeClient | null {
  if (typeof window !== "undefined") return null; // browser guard

  if (_nodeClient) return _nodeClient;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  if (!key) {
    console.warn(
      "[posthog] NEXT_PUBLIC_POSTHOG_KEY not set; server-side capture suppressed",
    );
    return null;
  }

  try {
    // Dynamic require keeps posthog-node out of the client bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require("posthog-node") as {
      PostHog: new (
        key: string,
        opts: { host: string; flushAt: number; flushInterval: number },
      ) => PostHogNodeClient;
    };
    _nodeClient = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  } catch (err) {
    console.warn(
      "[posthog] Failed to initialise posthog-node; server-side capture suppressed",
      err,
    );
  }

  return _nodeClient;
}

/**
 * Capture a server-side product event (Server Actions, Route Handlers, RSC).
 * No-op when NEXT_PUBLIC_POSTHOG_KEY is absent or called from the browser.
 *
 * No PII beyond userId (Supabase UUID).
 *
 * @example
 *   captureServerEvent(user.id, "checkout_started", { listing_count: 3 });
 */
export function captureServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const client = getNodeClient();
  if (!client) return;
  client.capture({ distinctId: userId, event, properties });
}

/**
 * Associate future server-side events with the Supabase user id.
 * Call once after authentication on the server path.
 * No PII beyond userId (Supabase UUID).
 */
export function identifyUser(userId: string): void {
  const client = getNodeClient();
  if (!client) return;
  client.identify({ distinctId: userId });
}
