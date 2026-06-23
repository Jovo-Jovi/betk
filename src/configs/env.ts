/**
 * Zod-validated environment loader — SERVER ONLY.
 *
 * The `server-only` import makes Next.js throw a build error if this file is
 * accidentally imported from a Client Component or any client bundle path.
 *
 * Exports:
 *   clientEnv  — validated NEXT_PUBLIC_* vars, for use in Server Components /
 *                Server Actions that need to forward them as props or reference
 *                them server-side.
 *   serverEnv  — server secrets that must never reach the browser.
 *
 * In Client Components, access NEXT_PUBLIC_* values via process.env directly
 * (Next.js inlines them at build time).  Never import serverEnv anywhere that
 * runs in the browser.
 */

import "server-only";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Client-safe vars (NEXT_PUBLIC_*)
// ---------------------------------------------------------------------------
const clientSchema = z.object({
  // Core infrastructure — always required
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Analytics / monitoring — optional in local dev (no-op when absent)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Server-only secrets — NEVER NEXT_PUBLIC_, never sent to the browser
// ---------------------------------------------------------------------------
const serverSchema = z.object({
  // Core infrastructure — always required
  SUPABASE_SERVICE_KEY: z.string().min(1),
  // OAuth — required from Phase 02; optional in Phase 01 local dev
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Transactional email (Resend) — optional; services fail-safe without it
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().email().optional(),
  // Sentry server DSN — optional; falls back to NEXT_PUBLIC_SENTRY_DSN
  SENTRY_DSN: z.string().url().optional(),
  // Supabase Storage buckets — optional; storage features degrade gracefully
  SUPABASE_DOCS_BUCKET: z.string().min(1).optional(),
  SUPABASE_MEDIA_BUCKET: z.string().min(1).optional(),
  // WhatsApp Cloud API — optional; sendTemplate no-ops without these
  WHATSAPP_API_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_ID: z.string().min(1).optional(),
  // SMS provider — optional; sendSms no-ops without this
  SMS_PROVIDER_KEY: z.string().min(1).optional(),
  // Courier / Bosta — optional; createShipment/getTracking no-op without this
  BOSTA_API_KEY: z.string().min(1).optional(),
});

function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] Missing or invalid ${label} environment variables:\n${missing}`,
    );
  }
  return result.data as z.infer<T>;
}

export const clientEnv = parseEnv(clientSchema, "client");
export const serverEnv = parseEnv(serverSchema, "server");
