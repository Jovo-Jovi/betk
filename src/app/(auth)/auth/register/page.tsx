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
 *   - Session exists + buyer_profiles row already exists → redirect to
 *     returnUrl or "/" (returning user; skip re-registration).
 *   - Session exists, no buyer_profiles → render the form.
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
import { createClient } from "@/lib/supabase/server";
import { hasBuyerProfile } from "@/services/authUsers";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { RegisterForm } from "./_components/RegisterForm";

export const metadata: Metadata = {
  title: "إكمال التسجيل — BETK",
  description: "أكمل ملفك الشخصي للمتابعة",
};

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

  // ── Skip if buyer_profiles already exists ─────────────────────────────────
  // Use service-role helper (via src/services/authUsers) to avoid cookie-timing
  // issues immediately after session creation. The check is read-only and keyed
  // to the verified GoTrue user.id — not a client-supplied value.
  const alreadyProfiled = await hasBuyerProfile(user.id);
  if (alreadyProfiled) {
    redirect((returnUrl || "/") as Route);
  }

  // ── Render form ────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">أكمل ملفك الشخصي</h1>
        <p className="text-sm text-muted-foreground">
          خطوة أخيرة — أخبرنا عن نفسك قليلاً
        </p>
      </div>

      {/* Profile completion form */}
      <RegisterForm returnUrl={returnUrl} />
    </div>
  );
}
