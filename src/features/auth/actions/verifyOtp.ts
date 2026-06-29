"use server";

/**
 * verifyOtp — Server Action for /auth/verify.
 *
 * AC-AUTH-2 full conformance:
 *   1. "never-persist-raw-OTP" — raw token never written to DB, logs, or Sentry.
 *   2. "expired/used tokens rejected" — GoTrue single-use invalidation + 60s expiry.
 *   3. "success creates a session" — GoTrue sets the cookie; middleware refreshes it.
 *   4. "≤5 attempts per token" — app-layer `recordOtpAttempt` backed by betk.otp_tokens.
 *
 * Post-auth flow:
 *   a. findOrCreateUser (T01 primitive) — mirrors auth.users → betk.users.
 *   b. updateLastLoginAt via service-role (betk.users has no self-UPDATE policy).
 *   c. R-A05 re-check — GoTrue might succeed for a deactivated user; block them here.
 *   d. role-route: buyer→returnUrl|'/'; seller→'/seller'|'/seller/status' (R-S04);
 *      admin→'/admin'; no buyer_profile (first sign-in) → '/auth/register' (T04).
 *
 * Per ADR-010 (Model A, GoTrue-canonical).
 */

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { otpVerifySchema } from "@/validations/auth";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { recordOtpAttempt, markOtpUsed } from "@/services/otpLimiter";
import { updateLastLoginAt, resolvePostAuthRedirect } from "@/services/authUsers";
import { findOrCreateUser, UserDeactivatedError, UserNotActiveError } from "@/features/auth";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

export interface VerifyOtpResult {
  success?: boolean;
  /** Arabic error message for display — generic when OTP is wrong/expired/used. */
  errorAr?: string;
}


export async function verifyOtp(
  _prevState: VerifyOtpResult | null,
  formData: FormData,
): Promise<VerifyOtpResult> {
  setFeatureContext("auth");

  // ── Zod validation ─────────────────────────────────────────────────────────
  const rawPhone = formData.get("phone");
  const rawToken = formData.get("token");

  const parsed = otpVerifySchema.safeParse({
    phone: rawPhone,
    token: rawToken,
  });

  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "بيانات غير صحيحة";
    return { errorAr: msg };
  }

  const { phone, token } = parsed.data;
  const returnUrl = sanitizeReturnUrl(
    typeof formData.get("returnUrl") === "string"
      ? (formData.get("returnUrl") as string)
      : null,
  );

  // ── AC-AUTH-2 clause 4: ≤5 attempts per token ─────────────────────────────
  // Increment BEFORE calling GoTrue so a timeout cannot buy an extra attempt.
  const limiter = await recordOtpAttempt(phone);

  if (!limiter.allowed) {
    return {
      errorAr: "تم تجاوز الحد الأقصى لعدد المحاولات. يُرجى طلب كود جديد.",
    };
  }

  // ── GoTrue verifyOtp ───────────────────────────────────────────────────────
  // NEVER log `token` — not in console, Sentry, or any error message.
  const supabase = await createClient();
  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (verifyError || !sessionData.user) {
    // GoTrue returns errors for: wrong code, expired, already used.
    // Map all to a single generic Arabic message (avoid enumeration).
    return {
      errorAr: "الكود غير صحيح أو منتهي الصلاحية. يُرجى المحاولة مرة أخرى أو طلب كود جديد.",
    };
  }

  const goTrueUser = sessionData.user;

  // ── Mark OTP as used (audit trail — best-effort) ──────────────────────────
  await markOtpUsed(phone);

  // ── a. findOrCreateUser (T01 primitive) ───────────────────────────────────
  let betKUser;
  try {
    betKUser = await findOrCreateUser({
      id: goTrueUser.id,
      phoneNumber: goTrueUser.phone ?? null,
      authProvider: "phone",
    });
  } catch (err) {
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      // R-A05: deactivated / suspended user — clear GoTrue session and block.
      await supabase.auth.signOut();
      return {
        errorAr: "هذا الحساب غير نشط. يُرجى التواصل مع الدعم.",
      };
    }
    captureTaggedError(err, "auth");
    return {
      errorAr: "حدث خطأ أثناء تسجيل الدخول. يُرجى المحاولة مرة أخرى.",
    };
  }

  // ── b. updateLastLoginAt (service-role — no self-UPDATE policy) ────────────
  try {
    await updateLastLoginAt(betKUser.id);
  } catch (err) {
    // Non-critical — don't block auth on a last_login_at write failure.
    captureTaggedError(err, "auth", { extra: { step: "updateLastLoginAt" } });
  }

  // ── ENTRY DEBT 2: Sentry.setUser({ id }) ──────────────────────────────────
  // Set on the server scope so errors in this request are tagged with the user id.
  // The client-side SentryProvider picks up the session and calls setUser there.
  Sentry.setUser({ id: betKUser.id });

  // ── PostHog: identify user after successful auth ───────────────────────────
  captureServerEvent(betKUser.id, "phone_otp_verified");

  // ── d. Role-based redirect ─────────────────────────────────────────────────
  const destination = await resolvePostAuthRedirect(
    betKUser.id,
    betKUser.role,
    returnUrl,
  );

  redirect(destination as Route);
}
