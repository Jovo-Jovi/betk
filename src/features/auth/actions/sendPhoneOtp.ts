"use server";

/**
 * sendPhoneOtp — Server Action for the phone-capture flow (/auth/phone, T07).
 *
 * Lets an already-authenticated, phone-NULL (Google) user request an OTP to a
 * NEW phone number they want to attach to their account.
 *
 * REUSE, NOT FORK: this is the GoTrue phone-change OTP path — the SAME hardened
 * GoTrue OTP mechanism as T02 sign-in, driven by `supabase.auth.updateUser
 * ({ phone })` (which sends the OTP and stages a pending phone change for an
 * authenticated user). The ≤5-attempt limiter is reused at verify time
 * (`verifyPhoneOtp`). We do NOT build a second OTP system.
 *
 * The phone is NOT written to betk.users here — only AFTER verify succeeds
 * (see `verifyPhoneOtp`). On send we merely trigger delivery.
 *
 * Security:
 *   • Must be authenticated AND currently phone-NULL (capture is for adding a
 *     first phone; users with a phone are bounced).
 *   • R-A05 defence-in-depth: a deactivated/suspended user is rejected.
 *   • UX pre-check via `isPhoneNumberTaken` so we don't send an OTP to a number
 *     already in use — but the authoritative collision guard is the 23505 catch
 *     at write time in `verifyPhoneOtp` (TOCTOU-safe).
 *   • Never logs/persists the phone in Sentry breadcrumbs or errors.
 *
 * Sentry feature tag: 'auth-phone-gate'.
 */

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { phoneInputSchema } from "@/validations/auth";
import { translateZodIssue } from "@/validations/zodMessages";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { getUserRowById, isPhoneNumberTaken } from "@/services/authUsers";
import { createOtpChallenge } from "@/services/otpLimiter";

export interface SendPhoneOtpResult {
  success: boolean;
  /** Normalised E.164 phone on success (forwarded to the verify step). */
  normalizedPhone?: string;
  /** Arabic-language error message for display; undefined on success. */
  errorAr?: string;
}

export async function sendPhoneOtp(
  _prevState: SendPhoneOtpResult | null,
  formData: FormData,
): Promise<SendPhoneOtpResult> {
  setFeatureContext("auth-phone-gate");

  const tValidation = await getTranslations("validation");
  const tErrors = await getTranslations("errors");

  // ── Zod validation + E.164 normalisation ──────────────────────────────────
  const parsed = phoneInputSchema.safeParse({ phone: formData.get("phone") });

  if (!parsed.success) {
    return {
      success: false,
      errorAr: translateZodIssue(tValidation, parsed.error.errors[0]?.message),
    };
  }

  const e164Phone = parsed.data.phone;

  // ── Authenticated session (id from live GoTrue session, never the form) ────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, errorAr: tErrors("mustLoginFirst") };
  }

  // ── Eligibility: active + currently phone-NULL ─────────────────────────────
  const row = await getUserRowById(user.id);
  if (!row) {
    return { success: false, errorAr: tErrors("accountNotFound") };
  }
  if (row.deleted_at !== null || row.status !== "active") {
    return { success: false, errorAr: tErrors("accountInactive") };
  }
  if (row.phone_number !== null) {
    return { success: false, errorAr: tErrors("phoneAlreadyVerified") };
  }

  // ── UX pre-check (authoritative guard is the 23505 catch at write time) ────
  if (await isPhoneNumberTaken(e164Phone)) {
    return { success: false, errorAr: tErrors("phoneTaken") };
  }

  // ── GoTrue phone-change OTP (reuses GoTrue OTP — not a second path) ────────
  const { error } = await supabase.auth.updateUser({ phone: e164Phone });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const isRateLimit =
      msg.includes("security purposes") ||
      msg.includes("rate limit") ||
      msg.includes("after") ||
      ("status" in error && (error as { status?: number }).status === 429);

    if (isRateLimit) {
      return {
        success: false,
        errorAr: tErrors("rateLimited"),
      };
    }

    // GoTrue may also reject if the phone is already registered to another
    // identity — surface a clean "in use" message rather than a generic error.
    if (msg.includes("already") && msg.includes("registered")) {
      return { success: false, errorAr: tErrors("phoneTaken") };
    }

    captureTaggedError(error, "auth-phone-gate", { extra: { step: "sendPhoneOtp.updateUser" } });
    return {
      success: false,
      errorAr: tErrors("sendOtpFailed"),
    };
  }

  // ── Open the ≤5-attempt challenge anchored to THIS OTP's 60s lifetime ──────
  // Same lifecycle-anchored limiter as sign-in (open-issue #12 fix) — reused,
  // not forked. Only after a successful GoTrue phone-change send.
  try {
    await createOtpChallenge(e164Phone);
  } catch (err) {
    captureTaggedError(err, "auth-phone-gate", { extra: { step: "createOtpChallenge" } });
    return {
      success: false,
      errorAr: tErrors("sendOtpFailed"),
    };
  }

  return { success: true, normalizedPhone: e164Phone };
}
