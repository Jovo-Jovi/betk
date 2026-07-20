"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "../Field";
import type { SlugStatus, StepErrors, WizardData } from "../wizardShared";

/**
 * Step 1 — Identity. Store name_ar (required) + name_en (optional, COALESCE
 * display set) + bio (as-authored, single language, Textarea) + slug picker with
 * a best-effort availability line (stores_public shows only ACTIVE stores, so
 * this can't see pending/suspended slugs — the 23505 at submit is authoritative,
 * R-S02).
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
  slugStatus: SlugStatus;
}

export function StepIdentity({ data, update, errors, slugStatus }: Props) {
  const t = useTranslations("seller.onboarding");

  const slugError = errors.slug ? t(`errors.${errors.slug}`) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Field
        htmlFor="nameAr"
        label={t("identity.nameArLabel")}
        error={errors.nameAr ? t(`errors.${errors.nameAr}`) : undefined}
        required
      >
        <Input
          id="nameAr"
          value={data.nameAr}
          onChange={(e) => update({ nameAr: e.target.value })}
          maxLength={100}
          placeholder={t("identity.nameArPlaceholder")}
          dir="rtl"
        />
      </Field>

      <Field
        htmlFor="nameEn"
        label={t("identity.nameEnLabel")}
        hint={t("identity.nameEnHint")}
        error={errors.nameEn ? t(`errors.${errors.nameEn}`) : undefined}
      >
        <Input
          id="nameEn"
          value={data.nameEn}
          onChange={(e) => update({ nameEn: e.target.value })}
          maxLength={100}
          placeholder={t("identity.nameEnPlaceholder")}
          dir="ltr"
        />
      </Field>

      <Field
        htmlFor="bioAr"
        label={t("identity.bioLabel")}
        hint={t("identity.bioHint")}
        error={errors.bioAr ? t(`errors.${errors.bioAr}`) : undefined}
      >
        <Textarea
          id="bioAr"
          value={data.bioAr}
          onChange={(e) => update({ bioAr: e.target.value })}
          maxLength={200}
          rows={3}
          placeholder={t("identity.bioPlaceholder")}
        />
      </Field>

      <Field
        htmlFor="slug"
        label={t("identity.slugLabel")}
        hint={slugError ? undefined : t("identity.slugHint")}
        error={slugError}
        required
      >
        <Input
          id="slug"
          value={data.slug}
          onChange={(e) => update({ slug: e.target.value.toLowerCase() })}
          maxLength={50}
          placeholder={t("identity.slugPlaceholder")}
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
        />
        {!slugError && slugStatus === "checking" && (
          <p className="text-xs text-muted-foreground">{t("identity.slugChecking")}</p>
        )}
        {!slugError && slugStatus === "available" && (
          <p className="text-xs text-success">{t("identity.slugAvailable")}</p>
        )}
        {!slugError && slugStatus === "taken" && (
          <p className="text-xs text-destructive">{t("identity.slugTaken")}</p>
        )}
      </Field>
    </div>
  );
}
