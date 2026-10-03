/**
 * /auth/register — buyer profile completion.
 *
 * Real URL: /auth/register  (the `(auth)` route group is URL-invisible).
 *
 * This is the landing page for newly-authed users who have no buyer_profiles
 * row. Both T02 (phone-OTP verify) and T03 (Google OAuth callback) call
 * resolvePostAuthRedirect → "/auth/register" when buyer_profiles is absent.
 *
 * Guard behaviour (self-enforced — the middleware classifies /auth/* as public):
 *   - No session (unauthenticated) → redirect to /auth/login.
 *   - Session exists + buyer_profiles row + current buyer_terms acceptance
 *     → redirect to returnUrl or "/".
 *   - Session exists and either the profile or the current acceptance is
 *     missing → render the form (REG-75 B). A profile alone is not enough.
 *
 * On submit: completeProfile Server Action upserts buyer_profiles using the
 * authenticated cookie client so the `bp_self` RLS policy is exercised.
 *
 * RTL Arabic — Phase DS owns visual styling; Phase 02 / T04.
 * UI Spec §3 AUTH — Complete Profile.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasBuyerProfile } from "@/services/authUsers";
import { readCurrentBuyerTerms } from "@/services/agreementVersions";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { RegisterForm } from "./_components/RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

interface Props {
  searchParams: Promise<{ returnUrl?: string }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const { returnUrl: rawReturnUrl } = await searchParams;
  const returnUrl = sanitizeReturnUrl(rawReturnUrl);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  // The middleware treats /auth/* as public; guard here in the RSC instead.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = returnUrl
      ? `/auth/login?returnUrl=${encodeURIComponent("/auth/register" + (rawReturnUrl ? `?returnUrl=${encodeURIComponent(rawReturnUrl)}` : ""))}`
      : "/auth/login";
    redirect(loginUrl as Route);
  }

  // ── Skip only when the profile AND the current buyer terms exist ──────────
  // A profile from before N26 is not a usable account (REG-75 B). The read is
  // keyed to the verified GoTrue user.id.
  const [alreadyProfiled, terms] = await Promise.all([
    hasBuyerProfile(user.id),
    readCurrentBuyerTerms(user.id),
  ]);
  if (alreadyProfiled && terms.accepted) {
    redirect((returnUrl || "/") as Route);
  }

  // ── Render form ────────────────────────────────────────────────────────────
  const t = await getTranslations("auth.register");

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Profile completion form */}
      <RegisterForm returnUrl={returnUrl} versionLabel={terms.version} />
    </div>
  );
}
