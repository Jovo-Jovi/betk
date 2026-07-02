"use server";

/**
 * sendOtp — Server Action for /auth/login.
 *
 * Validates an Egyptian phone number (Zod), normalises to E.164, and calls
 * `supabase.auth.signInWithOtp({ phone })` to trigger GoTrue phone-OTP delivery
 * via the live TorvoSMS hook.
 *
 * Security:
 *   • Never logs or persists the phone number in Sentry breadcrumbs or errors.
 *   • Rate-limit error (GoTrue 60s max_frequency / R-A02) → surfaced in Arabic.
 *   • Zod validation runs before any GoTrue call (CI zod-coverage guard).
 *
 * Per ADR-010 (Model A): GoTrue issues + delivers the OTP; app never hand-rolls.
 *
 * Google OAuth initiation is NOT a Server Action — it uses the browser Supabase
 * client from the GoogleSignInButton client component (see login/page.tsx).
 * The callback route is T03 scope.
 */

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { phoneInputSchema } from "@/validations/auth";
import { translateZodIssue } from "@/validations/zodMessages";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { createOtpChallenge } from "@/services/otpLimiter";

export interface SendOtpResult {
  success: boolean;
  /** Normalised E.164 phone on success (forwarded as hidden field to /auth/verify). */
  normalizedPhone?: string;
  /** Arabic-language error message for display; undefined on success. */
  errorAr?: string;
}

export async function sendOtp(
  _prevState: SendOtpResult | null,
  formData: FormData,
): Promise<SendOtpResult> {
  setFeatureContext("auth");

  const tValidation = await getTranslations("validation");
  const tErrors = await getTranslations("errors");

  // ── Zod validation + E.164 normalisation ──────────────────────────────────
  const raw = formData.get("phone");
  const parsed = phoneInputSchema.safeParse({ phone: raw });

  if (!parsed.success) {
    return {
      success: false,
      errorAr: translateZodIssue(tValidation, parsed.error.errors[0]?.message),
    };
  }

  const e164Phone = parsed.data.phone;

  // ── GoTrue signInWithOtp ───────────────────────────────────────────────────
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: e164Phone });

  if (error) {
    // GoTrue rate-limit: "For security purposes, you can only request this after Xs"
    // Also catches 429 from TorvoSMS upstream.
    const msg = error.message ?? "";
    const isRateLimit =
      msg.toLowerCase().includes("security purposes") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("after") ||
      ("status" in error && (error as { status?: number }).status === 429);

    if (isRateLimit) {
      return {
        success: false,
        errorAr: tErrors("rateLimited"),
      };
    }

    captureTaggedError(error, "auth");
    return {
      success: false,
      errorAr: tErrors("sendOtpFailed"),
    };
  }

  // ── Open the ≤5-attempt challenge anchored to THIS OTP's 60s lifetime ──────
  // Only after a successful GoTrue send (so we never supersede a still-valid
  // challenge on a rate-limited resend). The lifecycle-anchored limiter
  // (open-issue #12 fix) counts attempts against this single row at verify time.
  try {
    await createOtpChallenge(e164Phone);
  } catch (err) {
    // The SMS was sent but we couldn't open the attempt counter — fail closed:
    // without an active challenge row, verify would reject every attempt anyway.
    captureTaggedError(err, "auth", { extra: { step: "createOtpChallenge" } });
    return {
      success: false,
      errorAr: tErrors("sendOtpFailed"),
    };
  }

  return { success: true, normalizedPhone: e164Phone };
}
