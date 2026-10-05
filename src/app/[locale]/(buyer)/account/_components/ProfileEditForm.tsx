"use client";

/**
 * ProfileEditForm — client-side form for editing the buyer's profile.
 *
 * Fields: full_name (required), governorate (required), city (optional).
 * All fields target betk.buyer_profiles only (R-A06: phone_number is excluded
 * — it is read-only and never passed to this form or to updateProfile).
 *
 * Wires into the updateProfile Server Action via useActionState.
 * The kit Select does not submit a name, so a hidden input carries
 * `governorate`. updateProfile reads formData.get("governorate")
 * (src/features/buyer-account/actions/updateProfile.ts).
 *
 * REG-59 compose (decision 2026-10-05). Layout matches
 * /seller/store/returns: flex column, gap-6, kit controls.
 */

import { useState } from "react";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateProfile } from "@/features/buyer-account/actions/updateProfile";
import type { UpdateProfileResult } from "@/features/buyer-account/actions/updateProfile";
import { GOVERNORATES } from "@/constants/governorates";
import { Alert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [governorate, setGovernorate] = useState(initialGovernorate);
  const [state, formAction, isPending] = useActionState<
    UpdateProfileResult | null,
    FormData
  >(updateProfile, null);

  return (
    <form action={formAction} data-slot="profile-edit-form" className="flex flex-col gap-6">
      {state?.success && (
        <div role="status" data-slot="success-msg">
          <Alert variant="success" message={t("successMessage")} />
        </div>
      )}

      {state?.errorAr && (
        <div role="alert" data-slot="error-msg">
          <Alert variant="destructive" message={state.errorAr} />
        </div>
      )}

      <div data-slot="field" className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm font-medium text-foreground">
          {t("fullNameLabel")}
        </label>
        <Input
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

      <div data-slot="field" className="flex flex-col gap-1.5">
        <label htmlFor="governorate" className="text-sm font-medium text-foreground">
          {t("governorateLabel")}
        </label>
        <input type="hidden" name="governorate" value={governorate} />
        <Select
          value={governorate === "" ? undefined : governorate}
          onValueChange={setGovernorate}
          disabled={isPending}
        >
          <SelectTrigger id="governorate">
            <SelectValue placeholder={t("governoratePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {GOVERNORATES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {locale === "en" ? g.labelEn : g.labelAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div data-slot="field" className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-sm font-medium text-foreground">
          {t("cityLabel")}
        </label>
        <Input
          id="city"
          name="city"
          type="text"
          defaultValue={initialCity}
          maxLength={100}
          autoComplete="address-level2"
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending} data-slot="submit-btn">
        {isPending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
