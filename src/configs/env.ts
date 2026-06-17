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
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
});

// ---------------------------------------------------------------------------
// Server-only secrets — NEVER NEXT_PUBLIC_, never sent to the browser
// ---------------------------------------------------------------------------
const serverSchema = z.object({
  SUPABASE_SERVICE_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_ADDRESS: z.string().email(),
  SENTRY_DSN: z.string().url(),
  SUPABASE_DOCS_BUCKET: z.string().min(1),
  SUPABASE_MEDIA_BUCKET: z.string().min(1),
  WHATSAPP_API_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_ID: z.string().min(1),
  SMS_PROVIDER_KEY: z.string().min(1),
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
