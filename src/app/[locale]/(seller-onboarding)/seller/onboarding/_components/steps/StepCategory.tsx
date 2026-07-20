"use client";

import { useLocale, useTranslations } from "next-intl";
import { GOVERNORATES } from "@/constants/governorates";
import { Input } from "@/components/ui/input";
import { Field, SELECT_CLASS } from "../Field";
import type { CategoryOption, StepErrors, WizardData } from "../wizardShared";

/**
 * Step 2 — Category & location. Primary (required) + optional secondary from the
 * bilingual `categories` list (value = category slug, stored as text per the
 * free-text schema columns) + governorate (required) / city (optional) from the
 * governorate constant.
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
  categories: CategoryOption[];
}

export function StepCategory({ data, update, errors, categories }: Props) {
  const t = useTranslations("seller.onboarding");
  const locale = useLocale();
  const catLabel = (c: CategoryOption) => (locale === "en" ? c.labelEn : c.labelAr);
  const govLabel = (g: (typeof GOVERNORATES)[number]) =>
    locale === "en" ? g.labelEn : g.labelAr;

  return (
    <div className="flex flex-col gap-5">
      <Field
        htmlFor="categoryPrimary"
        label={t("category.primaryLabel")}
        error={errors.categoryPrimary ? t(`errors.${errors.categoryPrimary}`) : undefined}
        required
      >
        <select
          id="categoryPrimary"
          className={SELECT_CLASS}
          value={data.categoryPrimary}
          onChange={(e) => update({ categoryPrimary: e.target.value })}
        >
          <option value="">{t("category.primaryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {catLabel(c)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        htmlFor="categorySecondary"
        label={t("category.secondaryLabel")}
        hint={t("category.secondaryHint")}
        error={errors.categorySecondary ? t(`errors.${errors.categorySecondary}`) : undefined}
      >
        <select
          id="categorySecondary"
          className={SELECT_CLASS}
          value={data.categorySecondary}
          onChange={(e) => update({ categorySecondary: e.target.value })}
        >
          <option value="">{t("category.secondaryPlaceholder")}</option>
          {categories
            .filter((c) => c.value !== data.categoryPrimary)
            .map((c) => (
              <option key={c.value} value={c.value}>
                {catLabel(c)}
              </option>
            ))}
        </select>
      </Field>

      <Field
        htmlFor="governorate"
        label={t("category.governorateLabel")}
        error={errors.governorate ? t(`errors.${errors.governorate}`) : undefined}
        required
      >
        <select
          id="governorate"
          className={SELECT_CLASS}
          value={data.governorate}
          onChange={(e) => update({ governorate: e.target.value })}
        >
          <option value="">{t("category.governoratePlaceholder")}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {govLabel(g)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        htmlFor="city"
        label={t("category.cityLabel")}
        error={errors.city ? t(`errors.${errors.city}`) : undefined}
      >
        <Input
          id="city"
          value={data.city}
          onChange={(e) => update({ city: e.target.value })}
          maxLength={100}
          placeholder={t("category.cityPlaceholder")}
        />
      </Field>
    </div>
  );
}
