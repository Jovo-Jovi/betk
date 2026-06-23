/**
 * Next.js 15 client instrumentation entry point.
 * Loaded once per browser page-load by Next.js before any app code.
 *
 * Replaces the manual Sentry.init() call that was previously in
 * app/_providers/SentryProvider.tsx (T09 finding fix).
 *
 * No-op when NEXT_PUBLIC_SENTRY_DSN is absent (safe for local dev).
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_INIT_OPTIONS } from "@/services/sentry";

if (SENTRY_INIT_OPTIONS.dsn) {
  Sentry.init(SENTRY_INIT_OPTIONS);
}
