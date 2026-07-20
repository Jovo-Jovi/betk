"use client";

/**
 * DeliverySettingsForm — Phase 04 / T07 (FR-SEL-5). Composes the kit + ui
 * primitives for the /seller/store/delivery form. No new styled DS components
 * — a genuinely new component/state → STOP-and-flag to Claude Design.
 *
 * FLAGGED EXPANSION (REG-14, closed-with-evidence): exactly THREE mode
 * toggles {delivery, pickup, remote} — the live `StoreDeliveryOptions.modes`
 * shape — NOT the pack's canonical "4 mode toggles" wording (doc-vs-schema
 * divergence, T08-owned docs sync). The typed interface is consumed as-is,
 * never reshaped.
 *
 * ALL-MODES-OFF EDGE: the UI_SPEC gives a warning for disabling every
 * delivery method but does NOT say it blocks save — read as SAVEABLE with a
 * warning (no spec line forbids it). The warning renders live (not only at
 * submit) whenever zero modes are selected.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { GOVERNORATES } from "@/constants/governorates";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnStoreDelivery, whose @/lib/supabase/server import would
// leak next/headers into this client bundle (T06 precedent).
import { updateStoreDelivery } from "@/features/store-management/actions/updateStoreDelivery";
import { DELIVERY_MODES, type DeliveryMode } from "@/validations/storeDelivery";
import type { StoreDeliveryOptions } from "@/types/jsonb";
import { Alert, Toggle } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, SELECT_CLASS } from "../../_components/Field";

interface DeliveryFormValues {
  modes: DeliveryMode[];
  minDeliveryDays: string;
  maxDeliveryDays: string;
  deliveryFeeEgp: string;
  freeDeliveryThresholdEgp: string;
  pickupGovernorate: string;
  shipsNationwide: boolean;
}

interface Props {
  delivery: StoreDeliveryOptions;
}

/** Trim; empty → undefined (so an optional field is truly absent, not ""). */
function str(v: string): string | undefined {
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Trim; empty → undefined; else a finite number (or undefined if unparseable). */
function num(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function toFormValues(d: StoreDeliveryOptions): DeliveryFormValues {
  return {
    modes: d.modes ? [...d.modes] : [],
    minDeliveryDays: d.min_delivery_days !== undefined ? String(d.min_delivery_days) : "",
    maxDeliveryDays: d.max_delivery_days !== undefined ? String(d.max_delivery_days) : "",
    deliveryFeeEgp: d.delivery_fee_egp !== undefined ? String(d.delivery_fee_egp) : "",
    freeDeliveryThresholdEgp:
      d.free_delivery_threshold_egp !== undefined ? String(d.free_delivery_threshold_egp) : "",
    pickupGovernorate: d.pickup_governorate ?? "",
    shipsNationwide: d.ships_nationwide ?? false,
  };
}

type ErrCode = "invalid";
type FieldErrors = Partial<Record<keyof DeliveryFormValues, ErrCode>>;

export function DeliverySettingsForm({ delivery }: Props) {
  const t = useTranslations("seller.store");
  const locale = useLocale();
  const router = useRouter();

  const [data, setData] = React.useState<DeliveryFormValues>(() => toFormValues(delivery));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const update = React.useCallback((patch: Partial<DeliveryFormValues>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch)) delete next[k as keyof DeliveryFormValues];
      return next;
    });
  }, []);

  const toggleMode = (mode: DeliveryMode, on: boolean) =>
    update({ modes: on ? [...data.modes, mode] : data.modes.filter((m) => m !== mode) });

  const govLabel = (g: (typeof GOVERNORATES)[number]) => (locale === "en" ? g.labelEn : g.labelAr);

  const validate = React.useCallback((): FieldErrors => {
    const e: FieldErrors = {};
    const minDays = num(data.minDeliveryDays);
    if (data.minDeliveryDays.trim() !== "" && (minDays === undefined || minDays < 0 || minDays > 365)) {
      e.minDeliveryDays = "invalid";
    }
    const maxDays = num(data.maxDeliveryDays);
    if (data.maxDeliveryDays.trim() !== "" && (maxDays === undefined || maxDays < 0 || maxDays > 365)) {
      e.maxDeliveryDays = "invalid";
    }
    const fee = num(data.deliveryFeeEgp);
    if (data.deliveryFeeEgp.trim() !== "" && (fee === undefined || fee < 0 || fee > 100000)) {
      e.deliveryFeeEgp = "invalid";
    }
    const threshold = num(data.freeDeliveryThresholdEgp);
    if (
      data.freeDeliveryThresholdEgp.trim() !== "" &&
      (threshold === undefined || threshold < 0 || threshold > 1000000)
    ) {
      e.freeDeliveryThresholdEgp = "invalid";
    }
    return e;
  }, [data]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await updateStoreDelivery({
        modes: data.modes.length > 0 ? data.modes : undefined,
        min_delivery_days: num(data.minDeliveryDays),
        max_delivery_days: num(data.maxDeliveryDays),
        delivery_fee_egp: num(data.deliveryFeeEgp),
        free_delivery_threshold_egp: num(data.freeDeliveryThresholdEgp),
        pickup_governorate: str(data.pickupGovernorate),
        ships_nationwide: data.shipsNationwide || undefined,
      });

      if (res.ok) {
        toast.success(t("delivery.saved"));
        router.refresh();
        return;
      }
      switch (res.reason) {
        case "unauthenticated":
          router.push(routes.auth.login);
          break;
        case "blocked":
          router.push("/blocked");
          break;
        default:
          setFormError(t("delivery.saveFailed"));
      }
    } catch {
      setFormError(t("delivery.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-muted-foreground">{t("delivery.intro")}</p>

      {/* Exactly 3 delivery-mode toggles (REG-14 3-mode shape, not 4). */}
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <p className="text-sm font-medium text-foreground">{t("delivery.modesTitle")}</p>
        {DELIVERY_MODES.map((mode) => (
          <Toggle
            key={mode}
            id={`mode-${mode}`}
            label={t(`delivery.modes.${mode}`)}
            checked={data.modes.includes(mode)}
            onCheckedChange={(on) => toggleMode(mode, on)}
          />
        ))}
      </div>

      {data.modes.length === 0 && <Alert variant="warning" message={t("delivery.allModesOffWarning")} />}

      <div className="grid grid-cols-2 gap-4">
        <Field
          htmlFor="minDays"
          label={t("delivery.minDaysLabel")}
          error={errors.minDeliveryDays ? t(`delivery.errors.${errors.minDeliveryDays}`) : undefined}
        >
          <Input
            id="minDays"
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={data.minDeliveryDays}
            onChange={(e) => update({ minDeliveryDays: e.target.value })}
            placeholder="0"
            dir="ltr"
          />
        </Field>
        <Field
          htmlFor="maxDays"
          label={t("delivery.maxDaysLabel")}
          error={errors.maxDeliveryDays ? t(`delivery.errors.${errors.maxDeliveryDays}`) : undefined}
        >
          <Input
            id="maxDays"
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={data.maxDeliveryDays}
            onChange={(e) => update({ maxDeliveryDays: e.target.value })}
            placeholder="0"
            dir="ltr"
          />
        </Field>
      </div>

      <Field
        htmlFor="fee"
        label={t("delivery.feeLabel")}
        hint={errors.deliveryFeeEgp ? undefined : t("delivery.feeHint")}
        error={errors.deliveryFeeEgp ? t(`delivery.errors.${errors.deliveryFeeEgp}`) : undefined}
      >
        <Input
          id="fee"
          type="number"
          min={0}
          inputMode="decimal"
          value={data.deliveryFeeEgp}
          onChange={(e) => update({ deliveryFeeEgp: e.target.value })}
          placeholder="0"
          dir="ltr"
        />
      </Field>

      <Field
        htmlFor="freeThreshold"
        label={t("delivery.freeThresholdLabel")}
        hint={errors.freeDeliveryThresholdEgp ? undefined : t("delivery.freeThresholdHint")}
        error={
          errors.freeDeliveryThresholdEgp ? t(`delivery.errors.${errors.freeDeliveryThresholdEgp}`) : undefined
        }
      >
        <Input
          id="freeThreshold"
          type="number"
          min={0}
          inputMode="decimal"
          value={data.freeDeliveryThresholdEgp}
          onChange={(e) => update({ freeDeliveryThresholdEgp: e.target.value })}
          placeholder="0"
          dir="ltr"
        />
      </Field>

      <Field
        htmlFor="pickupGov"
        label={t("delivery.pickupGovLabel")}
        hint={t("delivery.pickupGovHint")}
      >
        <select
          id="pickupGov"
          className={SELECT_CLASS}
          value={data.pickupGovernorate}
          onChange={(e) => update({ pickupGovernorate: e.target.value })}
        >
          <option value="">{t("delivery.pickupGovPlaceholder")}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.value} value={g.value}>
              {govLabel(g)}
            </option>
          ))}
        </select>
      </Field>

      <div className="rounded-md border border-border p-4">
        <Toggle
          id="shipsNationwide"
          label={t("delivery.shipsNationwideLabel")}
          checked={data.shipsNationwide}
          onCheckedChange={(v) => update({ shipsNationwide: v })}
        />
      </div>

      {formError && <Alert variant="destructive" message={formError} />}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("delivery.saving") : t("delivery.save")}
        </Button>
      </div>
    </form>
  );
}
