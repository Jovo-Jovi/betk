"use server";

/**
 * verifyPhoneOtp — Server Action for the phone-capture flow (/auth/phone, T07).
 *
 * Verifies the OTP sent to the new phone (GoTrue phone-change), then — and ONLY
 * then — writes `betk.users.phone_number`. Ordering is structural and
 * load-bearing: the phone is written AFTER `verifyOtp` succeeds, never on send,
 * never optimistically.
 *
 * REUSE, NOT FORK:
 *   • ≤5-attempt limiter — the SAME `recordOtpAttempt` / `markOtpUsed`
 *     primitives as T02 (`betk.otp_tokens`); incremented BEFORE the GoTrue call
 *     so a timeout cannot buy a free attempt.
 *   • GoTrue verify — `verifyOtp({ type: 'phone_change' })`, the authenticated
 *     counterpart of T02's `type: 'sms'`. No second OTP system.
 *
 * WRITE PATH (T06 settled precedent): the `betk.users.phone_number` write goes
 * through the service-role helper `setUserPhoneNumber` (betk.users has no
 * permissive self-UPDATE policy; one is NOT to be added). `auth_provider` stays
 * 'google'.
 *
 * UNIQUE COLLISION: `setUserPhoneNumber` catches the Postgres 23505 from
 * `uq_users_phone` and returns `{ conflict: "phone_taken" }`; we surface a clean
 * Arabic "number already in use". We NEVER merge accounts. This 23505 catch —
 * not the send-time pre-check — is the authoritative guard (TOCTOU-safe).
 *
 * Sentry feature tag: 'auth-phone-gate'. NEVER log the raw OTP token.
 */

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { otpVerifySchema } from "@/validations/auth";
import { recordOtpAttempt, markOtpUsed } from "@/services/otpLimiter";
import { setUserPhoneNumber } from "@/services/authUsers";
import { setFeatureContext } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

export interface VerifyPhoneOtpResult {
  /** Arabic error message for display — generic when the OTP is wrong/expired. */
  errorAr?: string;
}

export async function verifyPhoneOtp(
  _prevState: VerifyPhoneOtpResult | null,
  formData: FormData,
): Promise<VerifyPhoneOtpResult> {
  setFeatureContext("auth-phone-gate");

  // ── Zod validation (reuses the T02 6-digit OTP schema) ─────────────────────
  const parsed = otpVerifySchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
  });

  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "بيانات غير صحيحة";
    return { errorAr: msg };
  }

  const { phone, token } = parsed.data;

  // ── Authenticated session (id from live GoTrue session, never the form) ────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { errorAr: "يجب تسجيل الدخول أولاً." };
  }

  // ── ≤5 attempts per token (REUSED limiter; increment BEFORE GoTrue) ────────
  const limiter = await recordOtpAttempt(phone);
  if (!limiter.allowed) {
    return { errorAr: "تم تجاوز الحد الأقصى لعدد المحاولات. يُرجى طلب كود جديد." };
  }

  // ── GoTrue phone-change verify ─────────────────────────────────────────────
  // NEVER log `token` — not in console, Sentry, or any error message.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "phone_change",
  });

  if (verifyError) {
    // wrong / expired / already-used — single generic message (avoid enumeration).
    return {
      errorAr: "الكود غير صحيح أو منتهي الصلاحية. يُرجى المحاولة مرة أخرى أو طلب كود جديد.",
    };
  }

  // ── Mark OTP used (best-effort audit) ──────────────────────────────────────
  await markOtpUsed(phone);

  // ── betk.users write — ONLY AFTER verify; service-role; 23505 is the guard ─
  const result = await setUserPhoneNumber(user.id, phone);

  if ("conflict" in result) {
    // uq_users_phone rejected at write time — clean message, never merge.
    return { errorAr: "رقم الهاتف مستخدم بالفعل في حساب آخر." };
  }

  // ── Observability (no PII beyond the user id) ──────────────────────────────
  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "phone_captured");

  // On success the user now passes requireVerifiedPhone() — return them to the
  // account page (or onward to a pending transaction in a future phase).
  redirect("/account" as Route);
}
