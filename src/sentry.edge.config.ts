/**
 * Sentry — Edge runtime configuration.
 * Imported by instrumentation.ts register() when NEXT_RUNTIME === "edge".
 *
 * Edge has the same access to process.env as Node.js in Next.js 15,
 * so we use the private DSN with the same fallback strategy as the server config.
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
