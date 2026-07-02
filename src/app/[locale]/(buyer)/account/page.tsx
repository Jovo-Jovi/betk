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
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/features/buyer-account/queries/getProfile";
import { ProfileEditForm } from "./_components/ProfileEditForm";
import { DeactivateAccountForm } from "./_components/DeactivateAccountForm";
import { LanguageSwitcher } from "./_components/LanguageSwitcher";
import { ThemeSwitcher } from "./_components/ThemeSwitcher";
import { Link } from "@/i18n/navigation";

/**
 * Phone-capture entry point path (T07 — /auth/phone is live). Uses the
 * locale-aware Link from @/i18n/navigation, so the href is a canonical
 * (locale-neutral) path that resolves under the current locale (OD-7).
 */
const PHONE_CAPTURE_PATH = "/auth/phone";

export default async function AccountPage() {
  const profile = await getProfile();

  if (!profile) {
    notFound();
  }

  const { buyerProfile, user } = profile;
  const t = await getTranslations("account");

  const isPhoneNull = user.phone_number === null || user.phone_number === undefined;
  const authProviderLabel =
    user.auth_provider === "google"
      ? t("authProviderGoogle")
      : t("authProviderPhone");

  return (
    <main data-slot="account-page">
      {/* ── Phone-add affordance (Google users without a phone) ─────────────── */}
      {isPhoneNull && (
        <div data-slot="phone-add-banner" role="alert" aria-live="polite">
          <p>
            {t("phoneAddBanner")}{" "}
            {/* T07 entry point — link only; phone-capture flow implemented in T07 */}
            <Link href={PHONE_CAPTURE_PATH}>{t("addPhoneLink")}</Link>
          </p>
        </div>
      )}

      <h1>{t("pageTitle")}</h1>

      {/* ── Read-only identity fields (betk.users — no UPDATE policy) ──────── */}
      <section data-slot="identity-info" aria-label={t("identityInfoLabel")}>
        <dl>
          <div>
            <dt>{t("phoneLabel")}</dt>
            {/* R-A06: phone_number is read-only — rendered, never editable */}
            <dd>
              {user.phone_number ?? (
                <span data-slot="phone-missing">
                  {t("phoneMissing")}{" "}
                  {/* T07 entry point */}
                  <Link href={PHONE_CAPTURE_PATH}>{t("addPhoneLink")}</Link>
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("authMethodLabel")}</dt>
            <dd>{authProviderLabel}</dd>
          </div>
        </dl>
      </section>

      {/* ── Editable profile fields (betk.buyer_profiles — bp_self RLS) ─────── */}
      <section data-slot="profile-edit" aria-label={t("editProfileLabel")}>
        <ProfileEditForm
          initialFullName={buyerProfile.full_name}
          initialGovernorate={buyerProfile.governorate}
          initialCity={buyerProfile.city ?? ""}
        />
      </section>

      {/* ── Settings: language (AR/EN) + theme (light/dark/system) — OD-7/BL-03 ── */}
      <section data-slot="account-settings" aria-label={t("settings.sectionLabel")}>
        <h2>{t("settings.title")}</h2>
        <LanguageSwitcher />
        <ThemeSwitcher />
      </section>

      {/* ── Account deactivation (OD-2 — sets users.deleted_at; no hard delete) ─ */}
      <section data-slot="account-deactivate" aria-label={t("deactivate.sectionLabel")}>
        <DeactivateAccountForm />
      </section>
    </main>
  );
}
