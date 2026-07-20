"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/shared";
import { Toggle } from "@/components/shared";
import { Field } from "../Field";
import type { StepErrors, WizardData } from "../wizardShared";

/**
 * Step 3 — Payment config. instapay_handle / vodafone_cash / orange_cash +
 * cod_enabled (Toggle). These are DISPLAY handles surfaced to buyers at checkout,
 * NOT secrets — the UI_SPEC note (§ Payment Methods) is rendered up top. All
 * fields optional here: R-S09 (≥1 method) is enforced at the Phase-05 publish
 * gate, not at onboarding — so this step never blocks advance.
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
}

export function StepPayment({ data, update, errors }: Props) {
  const t = useTranslations("seller.onboarding");
  const p = data.payment;
  const setPayment = (patch: Partial<WizardData["payment"]>) =>
    update({ payment: { ...p, ...patch } });

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="info" message={t("payment.note")} />

      <Field
        htmlFor="instapay"
        label={t("payment.instapayLabel")}
        error={errors["paymentMethods.instapay_handle"] ? t("errors.invalid") : undefined}
      >
        <Input
          id="instapay"
          value={p.instapay_handle}
          onChange={(e) => setPayment({ instapay_handle: e.target.value })}
          maxLength={100}
          placeholder={t("payment.instapayPlaceholder")}
          dir="ltr"
        />
      </Field>

      <Field
        htmlFor="vodafone"
        label={t("payment.vodafoneLabel")}
        error={errors["paymentMethods.vodafone_cash"] ? t("errors.invalid") : undefined}
      >
        <Input
          id="vodafone"
          value={p.vodafone_cash}
          onChange={(e) => setPayment({ vodafone_cash: e.target.value })}
          maxLength={20}
          placeholder={t("payment.vodafonePlaceholder")}
          dir="ltr"
          inputMode="tel"
        />
      </Field>

      <Field
        htmlFor="orange"
        label={t("payment.orangeLabel")}
        error={errors["paymentMethods.orange_cash"] ? t("errors.invalid") : undefined}
      >
        <Input
          id="orange"
          value={p.orange_cash}
          onChange={(e) => setPayment({ orange_cash: e.target.value })}
          maxLength={20}
          placeholder={t("payment.orangePlaceholder")}
          dir="ltr"
          inputMode="tel"
        />
      </Field>

      <div className="rounded-md border border-border p-4">
        <Toggle
          id="cod"
          label={t("payment.codLabel")}
          checked={p.cod_enabled}
          onCheckedChange={(v) => setPayment({ cod_enabled: v })}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("payment.atLeastOneHint")}</p>
    </div>
  );
}
