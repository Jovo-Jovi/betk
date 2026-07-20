"use client";

import { useLocale, useTranslations } from "next-intl";
import { GOVERNORATES } from "@/constants/governorates";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/shared";
import { Field, SELECT_CLASS } from "../Field";
import { DELIVERY_MODES, type DeliveryMode, type StepErrors, type WizardData } from "../wizardShared";

/**
 * Step 4 — Delivery config. Exactly THREE mode toggles — {delivery, pickup,
 * remote} — the REG-14-verified 3-mode `StoreDeliveryOptions.modes` shape (NOT
 * four); the typed interface is consumed as-is, never reshaped. Plus estimated
 * delivery days (min–max) + a default delivery fee, and a pickup governorate for
 * the pickup mode. `free_delivery_threshold_egp` / `ships_nationwide` are left to
 * the T07 delivery-settings page (optional in the typed shape) so this step keeps
 * exactly the 3 mode toggles. All optional here — the step never blocks advance.
 */
interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: StepErrors;
}

export function StepDelivery({ data, update }: Props) {
  const t = useTranslations("seller.onboarding");
  const locale = useLocale();
  const d = data.delivery;
  const setDelivery = (patch: Partial<WizardData["delivery"]>) =>
    update({ delivery: { ...d, ...patch } });

  const toggleMode = (mode: DeliveryMode, on: boolean) =>
    setDelivery({
      modes: on ? [...d.modes, mode] : d.modes.filter((m) => m !== mode),
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("delivery.intro")}</p>

      {/* Exactly 3 delivery-mode toggles (REG-14 3-mode shape). */}
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        {DELIVERY_MODES.map((mode) => (
          <Toggle
            key={mode}
            id={`mode-${mode}`}
            label={t(`delivery.modes.${mode}`)}
            checked={d.modes.includes(mode)}
            onCheckedChange={(on) => toggleMode(mode, on)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field htmlFor="minDays" label={t("delivery.minDaysLabel")}>
          <Input
            id="minDays"
            type="number"
            min={0}
            max={365}
            value={d.min_delivery_days}
            onChange={(e) => setDelivery({ min_delivery_days: e.target.value })}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
        <Field htmlFor="maxDays" label={t("delivery.maxDaysLabel")}>
          <Input
            id="maxDays"
            type="number"
            min={0}
            max={365}
            value={d.max_delivery_days}
            onChange={(e) => setDelivery({ max_delivery_days: e.target.value })}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field htmlFor="fee" label={t("delivery.feeLabel")} hint={t("delivery.feeHint")}>
        <Input
          id="fee"
          type="number"
          min={0}
          value={d.delivery_fee_egp}
          onChange={(e) => setDelivery({ delivery_fee_egp: e.target.value })}
          placeholder="0"
          inputMode="decimal"
          dir="ltr"
        />
      </Field>

      <Field htmlFor="pickupGov" label={t("delivery.pickupGovLabel")} hint={t("delivery.pickupGovHint")}>
        <select
          id="pickupGov"
          className={SELECT_CLASS}
          value={d.pickup_governorate}
          onChange={(e) => setDelivery({ pickup_governorate: e.target.value })}
        >
          <option value="">{t("delivery.pickupGovPlaceholder")}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {locale === "en" ? g.labelEn : g.labelAr}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
