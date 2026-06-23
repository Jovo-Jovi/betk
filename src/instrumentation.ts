/**
 * Next.js server instrumentation entry point.
 * Called once per runtime environment before the first request is handled.
 *
 * register()          — initialises Sentry on Node.js and Edge runtimes.
 * onRequestError      — forwards unhandled Server Component / Route Handler /
 *                       Server Action errors to Sentry automatically.
 *                       Complements the manual captureError() calls in server code.
 *
 * ARCHITECTURE §6 requirement: all three runtimes (browser via
 * instrumentation-client.ts, Node.js here, Edge here) must be wired.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Automatically capture errors thrown during server-side request handling
 * (Server Components, Route Handlers, Server Actions) before they reach
 * the error.tsx boundary.
 */
export const onRequestError = Sentry.captureRequestError;
