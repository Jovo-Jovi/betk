"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/shared";
import { Toggle } from "@/components/shared";
import { Field } from "../Field";
import type { StepErrors, WizardData } from "../wizardShared";

/**
 * Step 3 — Payment config. instapay_handle / vodafone_cash / orange_cash +
 * cod_enabled (Toggle).
 *
 * REG-55/OD-8 §7 (CORRECTION-02B): these handles are the BETK→seller
 * SETTLEMENT destination, NOT a buyer-facing pay-to surface — buyers pay
 * BETK's own rails, never the store's. Copy reworded accordingly (i18n
 * only, no shape change). All fields stay optional here: R-S09 (≥1
 * SETTLEMENT handle — instapay/vodafone_cash/orange_cash; REG-61,
 * cod_enabled no longer counts) is enforced at the Phase-05 publish gate,
 * not at onboarding — so this step never blocks advance.
 *
 * ⚠️ REG-63 (STOP-AND-FLAG, record-only): `cod_enabled` is now DEAD — COD is
 * universal under OD-8 §3.2 (every order carries the 50/50 split; COD is the
 * balance leg, remitted to BETK, never the store) and it gates nothing
 * buyer-facing anymore. The toggle is left in place unchanged (removing it
 * would be a JSONB/Zod/wizard shape change, not authorized here).
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
