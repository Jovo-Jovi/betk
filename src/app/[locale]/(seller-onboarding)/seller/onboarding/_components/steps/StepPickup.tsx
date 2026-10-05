"use client";

import { useLocale, useTranslations } from "next-intl";
import { GOVERNORATES } from "@/constants/governorates";
import { Input } from "@/components/ui/input";
import { Field } from "../Field";
import type { StepErrors, WizardData } from "../wizardShared";

/**
 * P23 pickup street. The governorate is the store's public governorate.
 * There is no delivery, pickup, or remote mode control (OD-10).
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
}

export function StepPickup({ data, update, errors }: Props) {
  const t = useTranslations("seller.onboarding");
  const locale = useLocale();
  const governorate = GOVERNORATES.find((g) => g.value === data.governorate);
  const governorateLabel = governorate
    ? locale === "en"
      ? governorate.labelEn
      : governorate.labelAr
    : data.governorate;

  return (
    <div className="flex flex-col gap-5" data-slot="onboarding-pickup">
      <p className="text-sm text-muted-foreground">{t("pickup.intro")}</p>
      <p className="text-sm text-foreground">
        {t("pickup.governorateNote", { governorate: governorateLabel })}
      </p>
      <Field
        htmlFor="streetAddress"
        label={t("pickup.streetLabel")}
        error={errors.streetAddress ? t(`errors.${errors.streetAddress}`) : undefined}
        required
      >
        <Input
          id="streetAddress"
          value={data.streetAddress}
          onChange={(e) => update({ streetAddress: e.target.value })}
          maxLength={2000}
        />
      </Field>
      <Field
        htmlFor="pickupCity"
        label={t("pickup.cityLabel")}
        error={errors.pickupCity ? t(`errors.${errors.pickupCity}`) : undefined}
        required
      >
        <Input
          id="pickupCity"
          value={data.pickupCity}
          onChange={(e) => update({ pickupCity: e.target.value })}
          maxLength={100}
        />
      </Field>
      <Field htmlFor="buildingNotes" label={t("pickup.notesLabel")} hint={t("pickup.notesHint")}>
        <Input
          id="buildingNotes"
          value={data.buildingNotes}
          onChange={(e) => update({ buildingNotes: e.target.value })}
          maxLength={2000}
        />
      </Field>
    </div>
  );
}
