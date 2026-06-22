// Vitest setup: make `@/configs/env` usable inside the Node test runtime.
//
// 1. Load `.env.local` into process.env (Vitest does not do this automatically).
//    Only the three Supabase keys need real values for the RLS harness:
//      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
//
// 2. configs/env.ts validates the FULL client+server env via Zod at import time
//    and throws if anything is missing. The harness only consumes the Supabase
//    keys, so we backfill harmless placeholders for every other required var so
//    the loader parses cleanly in tests. These placeholders are never used to
//    contact any real service.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// --- 1. .env.local -> process.env (do not override anything already set) ---
try {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // .env.local is optional — the harness self-skips when creds are absent.
}

// --- 2. placeholders for vars the harness does not use ---
const placeholders: Record<string, string> = {
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test_placeholder",
  NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
  NEXT_PUBLIC_SENTRY_DSN: "https://test@test.ingest.sentry.io/1",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  RESEND_API_KEY: "re_test_placeholder",
  RESEND_FROM_ADDRESS: "noreply@betk.test",
  SENTRY_DSN: "https://test@test.ingest.sentry.io/1",
  SUPABASE_DOCS_BUCKET: "seller-documents",
  SUPABASE_MEDIA_BUCKET: "listing-media",
  WHATSAPP_API_TOKEN: "test-whatsapp-token",
  WHATSAPP_PHONE_ID: "test-whatsapp-phone-id",
  SMS_PROVIDER_KEY: "test-sms-key",
};

for (const [key, value] of Object.entries(placeholders)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
