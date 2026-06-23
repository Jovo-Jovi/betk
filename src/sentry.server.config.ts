/**
 * Sentry — Node.js / server-side configuration.
 * Imported by instrumentation.ts register() when NEXT_RUNTIME === "nodejs".
 *
 * Uses the private SENTRY_DSN (server-only env) with fallback to the public
 * one so the setup works even when only the public key is configured.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
    debug: false,
  });
}
