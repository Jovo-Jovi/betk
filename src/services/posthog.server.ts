/**
 * PostHog server-side capture — Node.js runtime only.
 *
 * Import this in Server Actions, Route Handlers, and RSC — never in
 * client components or any file that PostHogProvider.tsx (use client) imports.
 *
 * The `server-only` guard makes Next.js throw a build error if this file is
 * accidentally imported from a client bundle path.
 *
 * No-PII policy:
 *   ✓  user.id (Supabase UUID — no personal meaning)
 *   ✗  email, phone_number, display_name, IP, or any free-text PII
 */

import "server-only";

/** Minimal type surface needed from posthog-node. The real PostHog class satisfies this shape. */
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

function getNodeClient(): PostHogNodeClient | null {
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
 * No-op when NEXT_PUBLIC_POSTHOG_KEY is absent.
 *
 * @example
 *   captureServerEvent(user.id, "checkout_started", { listing_count: 3 });
 */
export function captureServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  getNodeClient()?.capture({ distinctId: userId, event, properties });
}

/**
 * Associate future server-side events with the Supabase user id.
 * Call once after authentication on the server path.
 */
export function identifyUser(userId: string): void {
  getNodeClient()?.identify({ distinctId: userId });
}
