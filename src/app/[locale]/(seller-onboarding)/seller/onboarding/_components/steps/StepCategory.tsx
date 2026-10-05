"use client";

import { useLocale, useTranslations } from "next-intl";
import { GOVERNORATES } from "@/constants/governorates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "../Field";
import { chosenCategoryIds, type CategoryOption, type StepErrors, type WizardData } from "../wizardShared";

/**
 * P23 categories and the store's public governorate. Up to `categoryLimit`
 * selects. The database cap is the authority; this step only offers that many.
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
  categories: CategoryOption[];
  categoryLimit: number;
}

export function StepCategory({ data, update, errors, categories, categoryLimit }: Props) {
  const t = useTranslations("seller.onboarding");
  const locale = useLocale();
  const catLabel = (category: CategoryOption) => (locale === "en" ? category.labelEn : category.labelAr);
  const govLabel = (g: (typeof GOVERNORATES)[number]) => (locale === "en" ? g.labelEn : g.labelAr);
  const slots = data.categoryIds.slice(0, categoryLimit);

  const setSlot = (index: number, value: string) => {
    const next = slots.slice();
    while (next.length < categoryLimit) next.push("");
    next[index] = value === "none" ? "" : value;
    update({ categoryIds: next });
  };

  return (
    <div className="flex flex-col gap-5" data-slot="onboarding-categories">
      <p className="text-sm text-muted-foreground">{t("category.hint", { limit: categoryLimit })}</p>
      {slots.map((selected, index) => {
        const taken = new Set(chosenCategoryIds({ ...data, categoryIds: slots.filter((_, i) => i !== index) }));
        return (
          <Field
            key={index}
            htmlFor={`category-${index}`}
            label={t("category.slotLabel", { n: index + 1 })}
            error={index === 0 && errors.categoryIds ? t(`errors.${errors.categoryIds}`) : undefined}
            required={index === 0}
          >
            <Select value={selected || undefined} onValueChange={(value) => setSlot(index, value)}>
              <SelectTrigger id={`category-${index}`}>
                <SelectValue placeholder={t("category.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {index > 0 && <SelectItem value="none">{t("category.none")}</SelectItem>}
                {categories
                  .filter((category) => category.id === selected || !taken.has(category.id))
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {catLabel(category)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        );
      })}

      <Field
        htmlFor="governorate"
        label={t("category.governorateLabel")}
        error={errors.governorate ? t(`errors.${errors.governorate}`) : undefined}
        required
      >
        <Select
          value={data.governorate || undefined}
          onValueChange={(value) => update({ governorate: value })}
        >
          <SelectTrigger id="governorate">
            <SelectValue placeholder={t("category.governoratePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {GOVERNORATES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {govLabel(g)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          placeholder={t("category.cityPlaceholder")}
          maxLength={100}
        />
      </Field>
    </div>
  );
}
