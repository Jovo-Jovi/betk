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
 * REG-59 compose (decision 2026-10-05): kit only. Layout follows
 * /seller/store/returns (max-w-2xl column, gap-6, token type).
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/features/buyer-account/queries/getProfile";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/constants/routes";
import { Link } from "@/i18n/navigation";
import { ProfileEditForm } from "./_components/ProfileEditForm";
import { DeactivateAccountForm } from "./_components/DeactivateAccountForm";
import { LanguageSwitcher } from "./_components/LanguageSwitcher";
import { ThemeSwitcher } from "./_components/ThemeSwitcher";

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
    <main
      data-slot="account-page"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
    >
      {isPhoneNull && (
        <div data-slot="phone-add-banner" role="alert" aria-live="polite">
          <Alert variant="info">
            {t("phoneAddBanner")}{" "}
            <Button variant="link" asChild className="h-auto px-1">
              <Link href={PHONE_CAPTURE_PATH}>{t("addPhoneLink")}</Link>
            </Button>
          </Alert>
        </div>
      )}

      <h1 className="font-display text-lg font-bold text-foreground">{t("pageTitle")}</h1>
      <Button variant="link" asChild className="h-auto w-fit px-0">
        <Link href={routes.buyer.addresses}>{t("addressesLink")}</Link>
      </Button>

      <section data-slot="identity-info" aria-label={t("identityInfoLabel")}>
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-foreground">
              {t("identityInfoLabel")}
            </h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-phone" className="text-sm font-medium text-foreground">
                {t("phoneLabel")}
              </label>
              {user.phone_number ? (
                <Input
                  id="account-phone"
                  value={user.phone_number}
                  readOnly
                  dir="ltr"
                />
              ) : (
                <span data-slot="phone-missing">
                  {t("phoneMissing")}{" "}
                  <Button variant="link" asChild className="h-auto px-1">
                    <Link href={PHONE_CAPTURE_PATH}>{t("addPhoneLink")}</Link>
                  </Button>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="account-auth-method" className="text-sm font-medium text-foreground">
                {t("authMethodLabel")}
              </label>
              <Input id="account-auth-method" value={authProviderLabel} readOnly />
            </div>
          </CardContent>
        </Card>
      </section>

      <section data-slot="profile-edit" aria-label={t("editProfileLabel")}>
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-foreground">
              {t("editProfileLabel")}
            </h2>
          </CardHeader>
          <CardContent>
            <ProfileEditForm
              initialFullName={buyerProfile.full_name}
              initialGovernorate={buyerProfile.governorate}
              initialCity={buyerProfile.city ?? ""}
            />
          </CardContent>
        </Card>
      </section>

      <section data-slot="account-settings" aria-label={t("settings.sectionLabel")}>
        <Card>
          <CardHeader>
            <h2 className="font-display text-lg font-bold text-foreground">{t("settings.title")}</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </CardContent>
        </Card>
      </section>

      <section data-slot="account-deactivate" aria-label={t("deactivate.sectionLabel")}>
        <Card>
          <CardContent className="p-6">
            <DeactivateAccountForm />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
