/**
 * THROWAWAY DEV HARNESS — not part of the app, not for CI, do not commit to
 * the app surface.  Fires a real OTP via the live GoTrue → Send-SMS Hook →
 * TorvoSMS path on staging and prints only the normalised phone + GoTrue
 * response status.  Verify delivery by reading the TorvoSMS dashboard log,
 * then complete the flow at /auth/verify.
 *
 * Usage:
 *   pnpm exec tsx scripts/dev/send-otp-test.ts <phone>
 *   pnpm exec tsx scripts/dev/send-otp-test.ts 01001124312
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { phoneInputSchema } from "@/validations/auth";

// ── 1. Load .env.local into process.env ─────────────────────────────────────
// Same parser pattern as tests/setup/env.ts: do not override vars already set
// in the shell, strip optional surrounding quotes.
const repoRoot = resolve(dirname(process.argv[1]!), "..", "..");

try {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
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
  console.error("[send-otp-test] Cannot read .env.local — aborting.");
  process.exit(1);
}

// ── 2. Zod-validate the two required env vars (never printed) ────────────────
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  const missing = envResult.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`[send-otp-test] Missing or invalid env vars: ${missing}`);
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
  envResult.data;

// ── 3. STAGING_GUARD ─────────────────────────────────────────────────────────
// Refuse to run against any project other than the known staging ref.
// Same guard pattern as the RLS harness (tests/integration/rls.smoke.test.ts).
const STAGING_PROJECT_REF = "sojmjvohiziapiwkzsjg";
const detectedRef =
  new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] ?? "";

if (detectedRef !== STAGING_PROJECT_REF) {
  console.error(
    `[send-otp-test] STAGING_GUARD blocked: detected project "${detectedRef}", ` +
      `only "${STAGING_PROJECT_REF}" is permitted for this harness.`,
  );
  process.exit(1);
}

// ── 4. Parse + normalise phone number via the app's own schema ───────────────
const rawPhone = process.argv[2];
if (!rawPhone) {
  console.error(
    "[send-otp-test] Missing phone argument.\n" +
      "  Usage:   pnpm exec tsx scripts/dev/send-otp-test.ts <phone>\n" +
      "  Example: pnpm exec tsx scripts/dev/send-otp-test.ts 01001124312",
  );
  process.exit(1);
}

const phoneResult = phoneInputSchema.safeParse({ phone: rawPhone });
if (!phoneResult.success) {
  const msg = phoneResult.error.issues.map((i) => i.message).join("; ");
  console.error(`[send-otp-test] Phone validation failed: ${msg}`);
  process.exit(1);
}

const normalizedPhone = phoneResult.data.phone;
console.log(`Phone (normalised E.164): ${normalizedPhone}`);

// ── 5. Call signInWithOtp ────────────────────────────────────────────────────
// Uses the anon/browser-shape client — same surface the app uses.
// GoTrue never returns the raw OTP; it is not printed anywhere below.
const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function main(): Promise<void> {
  console.log("[send-otp-test] Calling supabase.auth.signInWithOtp …");

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
  });

  if (error) {
    console.error(`GoTrue error [${error.status ?? "n/a"}]: ${error.message}`);
    process.exit(1);
  }

  console.log("GoTrue status: success — OTP request accepted.");
  console.log(
    "Reminder: check the TorvoSMS dashboard log for the OTP code, " +
      "then verify via /auth/verify.",
  );
}

main().catch((err: unknown) => {
  console.error(
    "[send-otp-test] Unexpected error:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
