"use client";

/**
 * RegisterForm — buyer profile completion form.
 *
 * Collects full_name (required) + governorate (required) + optional city.
 * Connects to the `completeProfile` Server Action via useActionState.
 *
 * RTL Arabic — Phase DS owns all visual styling; compose only.
 * UI Spec §3 AUTH — Register / Complete Profile.
 */

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { completeProfile, type CompleteProfileResult } from "@/features/auth/actions/completeProfile";
import { GOVERNORATES } from "@/constants/governorates";

interface Props {
  returnUrl: string;
}

const initialState: CompleteProfileResult = {};

export function RegisterForm({ returnUrl }: Props) {
  const t = useTranslations("auth.register");
  const locale = useLocale();
  const [state, action, isPending] = useActionState(completeProfile, initialState);

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* hidden field so the action can redirect to the right place */}
      <input type="hidden" name="returnUrl" value={returnUrl} />

      {/* Full name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">
          {t("fullNameLabel")} <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          autoComplete="name"
          placeholder={t("fullNamePlaceholder")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-describedby={state.errorAr ? "form-error" : undefined}
        />
      </div>

      {/* Governorate */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="governorate" className="text-sm font-medium">
          {t("governorateLabel")} <span aria-hidden="true" className="text-destructive">*</span>
        </label>
        <select
          id="governorate"
          name="governorate"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          aria-describedby={state.errorAr ? "form-error" : undefined}
        >
          <option value="" disabled>
            {t("governoratePlaceholder")}
          </option>
          {GOVERNORATES.map((gov) => (
            <option key={gov.value} value={gov.value}>
              {locale === "en" ? gov.labelEn : gov.labelAr}
            </option>
          ))}
        </select>
      </div>

      {/* City (optional) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-sm font-medium">
          {t("cityLabel")}{" "}
          <span className="text-xs text-muted-foreground font-normal">{t("cityOptional")}</span>
        </label>
        <input
          id="city"
          name="city"
          type="text"
          autoComplete="address-level2"
          placeholder={t("cityPlaceholder")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Error message */}
      {state.errorAr && (
        <p
          id="form-error"
          role="alert"
          className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2"
        >
          {state.errorAr}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
