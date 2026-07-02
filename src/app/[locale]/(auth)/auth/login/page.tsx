/**
 * /auth/login — Phone entry + Google OAuth start.
 *
 * Public page (no session required). UI Spec §3 AUTH — Login.
 *
 * - Phone entry with Egyptian-format Zod validation (01X local + +20 E.164).
 *   Normalised to E.164 before signInWithOtp is called.
 * - Google continue button: initiates OAuth redirect (callback = T03 scope).
 * - returnUrl from query param — sanitised by sanitizeReturnUrl (open-redirect guard).
 * - R-A02: GoTrue max_frequency=60s; rate-limit error surfaced in Arabic.
 *
 * RTL + Arabic — Phase DS owns all visual styling.
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { PhoneLoginForm } from "./_components/PhoneLoginForm";
import { GoogleSignInButton } from "./_components/GoogleSignInButton";

interface Props {
  searchParams: Promise<{ returnUrl?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function LoginPage({ searchParams }: Props) {
  const { returnUrl: rawReturnUrl } = await searchParams;
  // Guard: only forward safe local paths.
  const returnUrl = sanitizeReturnUrl(rawReturnUrl);

  const t = await getTranslations("auth");
  const tCommon = await getTranslations("common");

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </div>

      {/* Phone OTP form */}
      <PhoneLoginForm returnUrl={returnUrl} />

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {tCommon("or")}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Google OAuth — button + initiating handler only; callback is T03 */}
      <GoogleSignInButton />

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {t("login.legalPrefix")}{" "}
        <span className="underline cursor-pointer">{t("login.terms")}</span>
        {" "}
        {t("login.and")}{" "}
        <span className="underline cursor-pointer">{t("login.privacy")}</span>
      </p>
    </div>
  );
}
