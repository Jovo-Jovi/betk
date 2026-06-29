/**
 * /auth/login — Phone entry + Google OAuth start.
 *
 * Public page (no session required). UI Spec §3 AUTH — Login.
 *
 * - Phone entry with Egyptian-format Zod validation (01X local + +20 E.164).
 *   Normalised to E.164 before signInWithOtp is called.
 * - "متابعة عبر Google" button: initiates OAuth redirect (callback = T03 scope).
 * - returnUrl from query param — sanitised by sanitizeReturnUrl (open-redirect guard).
 * - R-A02: GoTrue max_frequency=60s; rate-limit error surfaced in Arabic.
 *
 * RTL + Arabic — Phase DS owns all visual styling.
 */

import type { Metadata } from "next";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { PhoneLoginForm } from "./_components/PhoneLoginForm";
import { GoogleSignInButton } from "./_components/GoogleSignInButton";

export const metadata: Metadata = {
  title: "تسجيل الدخول — BETK",
  description: "ادخل رقم هاتفك للمتابعة",
};

interface Props {
  searchParams: Promise<{ returnUrl?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { returnUrl: rawReturnUrl } = await searchParams;
  // Guard: only forward safe local paths.
  const returnUrl = sanitizeReturnUrl(rawReturnUrl);

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">أهلاً بك في BETK</h1>
        <p className="text-sm text-muted-foreground">
          ادخل رقم هاتفك لاستلام كود التحقق
        </p>
      </div>

      {/* Phone OTP form */}
      <PhoneLoginForm returnUrl={returnUrl} />

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">أو</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Google OAuth — button + initiating handler only; callback is T03 */}
      <GoogleSignInButton />

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        بالمتابعة، أنت توافق على{" "}
        <span className="underline cursor-pointer">الشروط والأحكام</span>
        {" "}و{" "}
        <span className="underline cursor-pointer">سياسة الخصوصية</span>
      </p>
    </div>
  );
}
