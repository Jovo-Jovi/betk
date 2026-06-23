/**
 * Sentry service — shared init config + helpers.
 *
 * Initialisation is fully delegated to the Next.js instrumentation hooks:
 *   • Browser  → instrumentation-client.ts  (imports SENTRY_INIT_OPTIONS here)
 *   • Node.js  → instrumentation.ts register() → sentry.server.config.ts
 *   • Edge     → instrumentation.ts register() → sentry.edge.config.ts
 *
 * T11 will EXTEND this file with captureMessage, tag helpers, and breadcrumbs.
 * Do not recreate — extend only.
 */
import * as Sentry from "@sentry/nextjs";

/** Shared init options injected by SentryProvider (client) and instrumentation (server). */
export const SENTRY_INIT_OPTIONS = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 20 % traces in production; 0 in dev/test to keep quota clean.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
  debug: false,
} satisfies Parameters<typeof Sentry.init>[0];

/**
 * Capture an unexpected error.
 * Safe to call from Server Actions, Route Handlers, and Client Components.
 */
export function captureError(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(error, extra ? { extra } : undefined);
}
