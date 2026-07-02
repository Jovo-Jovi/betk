"use client";

/**
 * ProfileEditForm — client-side form for editing the buyer's profile.
 *
 * Fields: full_name (required), governorate (required), city (optional).
 * All fields target betk.buyer_profiles only (R-A06: phone_number is excluded
 * — it is read-only and never passed to this form or to updateProfile).
 *
 * Wires into the updateProfile Server Action via useActionState.
 *
 * Phase 02 / T05.
 * TODO(Phase DS): restyle with Claude Design system components.
 */

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateProfile } from "@/features/buyer-account/actions/updateProfile";
import type { UpdateProfileResult } from "@/features/buyer-account/actions/updateProfile";
import { GOVERNORATES } from "@/constants/governorates";

interface ProfileEditFormProps {
  initialFullName: string;
  initialGovernorate: string;
  initialCity: string;
}

export function ProfileEditForm({
  initialFullName,
  initialGovernorate,
  initialCity,
}: ProfileEditFormProps) {
  const t = useTranslations("account.profileForm");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState<
    UpdateProfileResult | null,
    FormData
  >(updateProfile, null);

  return (
    <form action={formAction} data-slot="profile-edit-form">
      {/* Success message */}
      {state?.success && (
        <p role="status" data-slot="success-msg">
          {t("successMessage")}
        </p>
      )}

      {/* Error message */}
      {state?.errorAr && (
        <p role="alert" data-slot="error-msg">
          {state.errorAr}
        </p>
      )}

      {/* full_name */}
      <div data-slot="field">
        <label htmlFor="full_name">{t("fullNameLabel")}</label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={initialFullName}
          required
          maxLength={100}
          autoComplete="name"
          disabled={isPending}
        />
      </div>

      {/* governorate */}
      <div data-slot="field">
        <label htmlFor="governorate">{t("governorateLabel")}</label>
        <select
          id="governorate"
          name="governorate"
          defaultValue={initialGovernorate}
          required
          disabled={isPending}
        >
          <option value="">{t("governoratePlaceholder")}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {locale === "en" ? g.labelEn : g.labelAr}
            </option>
          ))}
        </select>
      </div>

      {/* city (optional) */}
      <div data-slot="field">
        <label htmlFor="city">{t("cityLabel")}</label>
        <input
          id="city"
          name="city"
          type="text"
          defaultValue={initialCity}
          maxLength={100}
          autoComplete="address-level2"
          disabled={isPending}
        />
      </div>

      <button type="submit" disabled={isPending} data-slot="submit-btn">
        {isPending ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
