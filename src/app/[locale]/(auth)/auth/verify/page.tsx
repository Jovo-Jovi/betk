/**
 * /auth/verify — 6-digit OTP verification.
 *
 * Public page (no session required — user is mid-auth). UI Spec §3 AUTH — Verify.
 *
 * Receives `phone` (E.164) and `returnUrl` from query params set by the login page.
 * Both are sanitised server-side:
 *   - phone: validated against E.164 Egyptian format; redirect to login if invalid.
 *   - returnUrl: sanitiseReturnUrl (open-redirect guard).
 *
 * AC-AUTH-2 enforcement lives in the `verifyOtp` Server Action.
 *
 * RTL + Arabic — Phase DS owns all visual styling.
 */

import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { OtpVerifyForm } from "./_components/OtpVerifyForm";

export const metadata: Metadata = {
  title: "تأكيد الكود — BETK",
  description: "أدخل كود التحقق المرسل إلى هاتفك",
};

/** Mask all but the last 4 digits of a phone number for display. */
function maskPhone(e164: string): string {
  // e.g. +201012345678 → +20*******5678
  if (e164.length <= 4) return e164;
  return e164.slice(0, 3) + "*".repeat(e164.length - 7) + e164.slice(-4);
}

const EGYPTIAN_E164_RE = /^\+201[0-9]{9}$/;

interface Props {
  searchParams: Promise<{ phone?: string; returnUrl?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const { phone: rawPhone, returnUrl: rawReturnUrl } = await searchParams;

  // Validate the phone before rendering. An invalid phone means the user navigated
  // here directly (skipping the login step) — send them back to login.
  if (!rawPhone || !EGYPTIAN_E164_RE.test(rawPhone)) {
    redirect("/auth/login" as Route);
  }

  const returnUrl = sanitizeReturnUrl(rawReturnUrl);
  const maskedPhone = maskPhone(rawPhone);

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">تأكيد رقم هاتفك</h1>
        <p className="text-sm text-muted-foreground">
          أدخل كود التحقق المؤلف من ٦ أرقام والمُرسَل إلى هاتفك.
          <br />
          <span className="text-xs">
            الكود صالح لمدة ٦٠ ثانية فقط.
          </span>
        </p>
      </div>

      {/* OTP form — AC-AUTH-2 enforcement in Server Action */}
      <OtpVerifyForm
        phone={rawPhone}
        maskedPhone={maskedPhone}
        returnUrl={returnUrl}
      />

      {/* Back link */}
      <p className="text-sm text-center text-muted-foreground">
        رقم خاطئ؟{" "}
        <a
          href={`/auth/login${returnUrl !== "/" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
          className="text-primary underline underline-offset-4 hover:no-underline"
        >
          تعديل الرقم
        </a>
      </p>
    </div>
  );
}
