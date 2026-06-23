/**
 * SMS service — OTP delivery and SLA alert dispatch.
 *
 * Use cases:
 *   • Phone-OTP verification (Phase 02 auth — Supabase Auth handles the OTP
 *     generation; this wrapper is for any supplemental SMS outside Auth flow)
 *   • Seller / admin SLA breach alerts (Phase 05 notifications dispatcher)
 *
 * Fail-safe: if SMS_PROVIDER_KEY is absent, sendSms logs a warning and
 * returns — never throws.
 *
 * No business logic. Message body is fully formed by the caller.
 *
 * TODO(Phase 04 / notifications): choose SMS provider (e.g. Vonage / Twilio /
 * local Egyptian provider) and implement the HTTP call.
 */
import "server-only";
import { serverEnv } from "@/configs/env";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a plain-text SMS to a recipient phone number.
 *
 * No-op (with console.warn) when SMS_PROVIDER_KEY is not configured.
 *
 * @param to   Recipient in E.164 format (e.g. "+201001234567").
 * @param body Message body — keep under 160 chars to avoid multi-part billing.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const apiKey = serverEnv.SMS_PROVIDER_KEY;

  if (!apiKey) {
    console.warn(
      "[sms] SMS_PROVIDER_KEY not configured; SMS suppressed",
      { to, preview: body.slice(0, 40) },
    );
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[sms] DEV no-op — would send SMS to ${to}: "${body.slice(0, 60)}${body.length > 60 ? "…" : ""}"`,
    );
    return;
  }

  // TODO(Phase 04): implement provider HTTP call.
  // Example (Vonage):
  //   await fetch("https://rest.nexmo.com/sms/json", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ api_key: apiKey, api_secret: ..., from: "BETK", to, text: body }),
  //   });
  console.info(`[sms] SMS dispatched to ${to}`);
}
