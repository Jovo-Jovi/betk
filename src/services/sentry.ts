/**
 * Sentry service — shared init config + helpers.
 *
 * Initialisation is fully delegated to the Next.js instrumentation hooks:
 *   • Browser  → instrumentation-client.ts  (imports SENTRY_INIT_OPTIONS here)
 *   • Node.js  → instrumentation.ts register() → sentry.server.config.ts
 *   • Edge     → instrumentation.ts register() → sentry.edge.config.ts
 *
 * Per ARCHITECTURE §6: tag errors by feature + user role.
 * T09 exports (SENTRY_INIT_OPTIONS, captureError) are preserved unchanged.
 */
import * as Sentry from "@sentry/nextjs";
import type { UserRole } from "@/constants/enums";

// ---------------------------------------------------------------------------
// Init config (T09 — unchanged)
// ---------------------------------------------------------------------------

/** Shared init options injected by SentryProvider (client) and instrumentation (server). */
export const SENTRY_INIT_OPTIONS = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 20 % traces in production; 0 in dev/test to keep quota clean.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
  debug: false,
} satisfies Parameters<typeof Sentry.init>[0];

// ---------------------------------------------------------------------------
// Feature taxonomy (ARCHITECTURE §6)
// ---------------------------------------------------------------------------

/** Feature areas mapped to Sentry tag values for cross-cutting observability. */
export type SentryFeature =
  | "auth"
  | "checkout"
  | "discovery"
  | "listing"
  | "orders"
  | "disputes"
  | "messaging"
  | "seller-onboarding"
  | "store-management"
  | "seller-analytics"
  | "payouts"
  | "admin"
  | "boosts"
  | "notifications"
  | "reviews";

// ---------------------------------------------------------------------------
// Error / message capture (T09 export preserved + new helpers)
// ---------------------------------------------------------------------------

/**
 * Capture an unexpected error.
 * Safe to call from Server Actions, Route Handlers, and Client Components.
 * Signature unchanged from T09 — existing callers are unaffected.
 */
export function captureError(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(error, extra ? { extra } : undefined);
}

/**
 * Capture a non-fatal message (e.g. degraded-path warnings, missing data).
 */
export function captureMessage(
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (extra) {
    Sentry.withScope((scope) => {
      scope.setExtras(extra);
      Sentry.captureMessage(message);
    });
  } else {
    Sentry.captureMessage(message);
  }
}

/**
 * Capture an error scoped to a specific feature + optional role (ARCHITECTURE §6).
 * Uses a temporary scope so tags don't bleed into subsequent events.
 */
export function captureTaggedError(
  error: unknown,
  feature: SentryFeature,
  options?: { role?: UserRole; extra?: Record<string, unknown> },
): void {
  Sentry.withScope((scope) => {
    scope.setTag("feature", feature);
    if (options?.role) scope.setTag("user.role", options.role);
    if (options?.extra) scope.setExtras(options.extra);
    scope.captureException(error);
  });
}

// ---------------------------------------------------------------------------
// Tag / context helpers (ARCHITECTURE §6)
// ---------------------------------------------------------------------------

/**
 * Set a persistent Sentry tag on the current scope.
 * Useful in middleware or layout to annotate all subsequent events in the request.
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Annotate the current scope with the active feature area and user role.
 * Call once near the top of a Server Action or Route Handler.
 *
 * @example
 *   setFeatureContext("checkout", user.role);
 */
export function setFeatureContext(
  feature: SentryFeature,
  role?: UserRole,
): void {
  Sentry.setTag("feature", feature);
  if (role) Sentry.setTag("user.role", role);
}
