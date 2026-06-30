/**
 * /account — Buyer profile page (read + edit).
 *
 * - Protected: the T10 middleware gates /account as buyer-protected and
 *   enforces R-A05 (active + deleted_at IS NULL). This RSC page assumes an
 *   authed, active user and does NOT re-implement the auth/active guard.
 * - phone_number: READ-ONLY (R-A06) — rendered, never editable.
 * - auth_provider: READ-ONLY info — rendered as sign-in method.
 * - Editable fields: full_name, governorate, city (all on betk.buyer_profiles).
 *   Zod-validated Server Action running as the authenticated user under
 *   bp_self policy (PERMISSIVE FOR ALL USING id = auth.uid()).
 * - Google user with phone_number NULL: non-blocking "add phone" affordance
 *   linking to the phone-capture entry point (flow implemented in T07).
 *
 * Phase 02 / T05.
 */

import { notFound } from "next/navigation";
import type { Route } from "next";
import { getProfile } from "@/features/buyer-account/queries/getProfile";
import { ProfileEditForm } from "./_components/ProfileEditForm";
import { DeactivateAccountForm } from "./_components/DeactivateAccountForm";
import Link from "next/link";

/**
 * Phone-capture entry point path (T07 — /auth/phone is now live; the page
 * consumes requireVerifiedPhone() to gate + drive the capture flow). Cast to
 * Route because the standalone `tsc` typecheck doesn't regenerate Next's
 * build-time typed-routes union (repo convention for route literals).
 */
const PHONE_CAPTURE_PATH = "/auth/phone" as Route;

const AUTH_PROVIDER_LABELS: Record<string, string> = {
  phone: "رقم الهاتف (OTP)",
  google: "Google",
};

export default async function AccountPage() {
  const profile = await getProfile();

  if (!profile) {
    notFound();
  }

  const { buyerProfile, user } = profile;

  const isPhoneNull = user.phone_number === null || user.phone_number === undefined;
  const authProviderLabel =
    AUTH_PROVIDER_LABELS[user.auth_provider] ?? user.auth_provider;

  return (
    <main data-slot="account-page">
      {/* ── Phone-add affordance (Google users without a phone) ─────────────── */}
      {isPhoneNull && (
        <div data-slot="phone-add-banner" role="alert" aria-live="polite">
          <p>
            لإتمام الشراء أو أي معاملة، يجب إضافة رقم هاتف موثّق.{" "}
            {/* T07 entry point — link only; phone-capture flow implemented in T07 */}
            <Link href={PHONE_CAPTURE_PATH}>أضف رقم هاتف</Link>
          </p>
        </div>
      )}

      <h1>الملف الشخصي</h1>

      {/* ── Read-only identity fields (betk.users — no UPDATE policy) ──────── */}
      <section data-slot="identity-info" aria-label="بيانات الحساب">
        <dl>
          <div>
            <dt>رقم الهاتف</dt>
            {/* R-A06: phone_number is read-only — rendered, never editable */}
            <dd>
              {user.phone_number ?? (
                <span data-slot="phone-missing">
                  لم يُضَف بعد —{" "}
                  {/* T07 entry point */}
                  <Link href={PHONE_CAPTURE_PATH}>أضف رقم هاتف</Link>
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>طريقة تسجيل الدخول</dt>
            <dd>{authProviderLabel}</dd>
          </div>
        </dl>
      </section>

      {/* ── Editable profile fields (betk.buyer_profiles — bp_self RLS) ─────── */}
      <section data-slot="profile-edit" aria-label="تعديل الملف الشخصي">
        <ProfileEditForm
          initialFullName={buyerProfile.full_name}
          initialGovernorate={buyerProfile.governorate}
          initialCity={buyerProfile.city ?? ""}
        />
      </section>

      {/* ── Account deactivation (OD-2 — sets users.deleted_at; no hard delete) ─ */}
      <section data-slot="account-deactivate" aria-label="تعطيل الحساب">
        <DeactivateAccountForm />
      </section>
    </main>
  );
}
