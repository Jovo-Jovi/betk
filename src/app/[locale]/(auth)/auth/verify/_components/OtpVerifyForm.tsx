"use client";

/**
 * OtpVerifyForm — client component for /auth/verify.
 *
 * 6-digit OTP entry wired to the `verifyOtp` Server Action via `useActionState`.
 * Hidden fields carry `phone` (E.164) and `returnUrl` (sanitised) from the
 * login page — neither is displayed to the user.
 *
 * SECURITY:
 *   • The OTP token is submitted as a form field; it is NEVER stored in
 *     localStorage, sessionStorage, or any log.
 *   • The phone is a URL-safe E.164 string — not PII in the same sense as
 *     name/email, but still not logged.
 *
 * Design system: Phase DS owns visuals — do NOT restyle.
 */

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { verifyOtp, type VerifyOtpResult } from "@/features/auth/actions/verifyOtp";

interface Props {
  phone: string;
  maskedPhone: string;
  returnUrl: string;
}

const initialState: VerifyOtpResult = {};

export function OtpVerifyForm({ phone, maskedPhone, returnUrl }: Props) {
  const t = useTranslations("auth.verify");
  const [state, formAction, isPending] = useActionState(verifyOtp, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full">
      {/* Hidden fields — forwarded to the Server Action */}
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="returnUrl" value={returnUrl} />

      <p className="text-sm text-muted-foreground text-center">
        {t("sentTo")}{" "}
        <span className="font-mono font-semibold text-foreground" dir="ltr">
          {maskedPhone}
        </span>
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="token" className="text-sm font-medium text-foreground">
          {t("otpLabel")}
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
          disabled={isPending}
          className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-xl tracking-[0.5em] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-describedby={state.errorAr ? "otp-error" : undefined}
          aria-invalid={!!state.errorAr}
        />
        {state.errorAr && (
          <p id="otp-error" className="text-sm text-destructive" role="alert">
            {state.errorAr}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? t("verifying") : t("confirm")}
      </button>
    </form>
  );
}
