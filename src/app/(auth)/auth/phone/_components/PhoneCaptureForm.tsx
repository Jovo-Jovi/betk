"use client";

/**
 * PhoneCaptureForm — two-step phone-capture (Phase 02 / T07).
 *
 * Step 1: enter an Egyptian phone number → `sendPhoneOtp` triggers the GoTrue
 *         phone-change OTP.
 * Step 2: enter the 6-digit code → `verifyPhoneOtp` verifies it and (only then)
 *         writes betk.users.phone_number, redirecting to /account on success.
 *
 * Both steps reuse the EXISTING auth Server Actions / OTP primitives — no
 * second OTP path. The phone is written ONLY after verify succeeds (server-side).
 *
 * Design system: compose placeholders only; Phase DS owns visuals — do NOT
 * restyle here.
 */

import { useActionState } from "react";
import {
  sendPhoneOtp,
  type SendPhoneOtpResult,
} from "@/features/auth/actions/sendPhoneOtp";
import {
  verifyPhoneOtp,
  type VerifyPhoneOtpResult,
} from "@/features/auth/actions/verifyPhoneOtp";

const sendInitial: SendPhoneOtpResult = { success: false };
const verifyInitial: VerifyPhoneOtpResult = {};

/** Mask all but the last 4 digits of an E.164 phone for display. */
function maskPhone(e164: string): string {
  if (e164.length <= 4) return e164;
  return e164.slice(0, 3) + "*".repeat(e164.length - 7) + e164.slice(-4);
}

export function PhoneCaptureForm() {
  const [sendState, sendAction, sendPending] = useActionState(
    sendPhoneOtp,
    sendInitial,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyPhoneOtp,
    verifyInitial,
  );

  const otpSent = sendState.success && !!sendState.normalizedPhone;

  // ── Step 2: OTP verification ───────────────────────────────────────────────
  if (otpSent) {
    const phone = sendState.normalizedPhone!;
    return (
      <form action={verifyAction} className="flex flex-col gap-4 w-full" dir="rtl">
        {/* Hidden field — the E.164 phone the OTP was sent to. */}
        <input type="hidden" name="phone" value={phone} />

        <p className="text-sm text-muted-foreground text-center">
          أُرسل الكود إلى{" "}
          <span className="font-mono font-semibold text-foreground" dir="ltr">
            {maskPhone(phone)}
          </span>
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="token" className="text-sm font-medium text-foreground">
            كود التحقق (٦ أرقام)
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            dir="ltr"
            placeholder="000000"
            required
            disabled={verifyPending}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-xl tracking-[0.5em] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-describedby={verifyState.errorAr ? "otp-error" : undefined}
            aria-invalid={!!verifyState.errorAr}
          />
          {verifyState.errorAr && (
            <p id="otp-error" className="text-sm text-destructive" role="alert">
              {verifyState.errorAr}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={verifyPending}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {verifyPending ? "جارٍ التحقق…" : "تأكيد الرقم"}
        </button>
      </form>
    );
  }

  // ── Step 1: phone entry ────────────────────────────────────────────────────
  return (
    <form action={sendAction} className="flex flex-col gap-4 w-full" dir="rtl">
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-foreground">
          رقم الهاتف
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          required
          disabled={sendPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-start"
          aria-describedby={sendState.errorAr ? "phone-error" : undefined}
          aria-invalid={!!sendState.errorAr}
        />
        {sendState.errorAr && (
          <p id="phone-error" className="text-sm text-destructive" role="alert">
            {sendState.errorAr}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={sendPending}
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {sendPending ? "جارٍ الإرسال…" : "إرسال الكود"}
      </button>
    </form>
  );
}
