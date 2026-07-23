"use client";

/**
 * PaymentsSettingsForm — Phase 04 / T07 (FR-SEL-7 / R-S09 config). Composes
 * the kit + ui primitives for the /seller/store/payments form. No new styled
 * DS components — a genuinely new component/state → STOP-and-flag to Claude
 * Design.
 *
 * Handles are DISPLAY values surfaced to buyers at checkout, NOT secrets —
 * the UI_SPEC note is rendered up top (info Alert).
 *
 * ⚠️ REG-64 (flagged, NOT fixed here — out of CORRECTION-02B's explicit
 * scope, which named only the storefront render + publish gate + onboarding
 * step 3): under OD-8 §7 this column — and this page's copy — describe the
 * BETK→seller SETTLEMENT destination, not a buyer-facing pay-to surface. The
 * `t("payments.note")` string below is stale (still says "shown to buyers at
 * checkout"). A dedicated task should reword it the same way StepPayment's
 * i18n was reworded.
 *
 * R-S09 ENFORCEMENT NOTE (read before touching this banner): the warning
 * below is CONFIG + BANNER ONLY. It never blocks this save, and this page/
 * action never checks "≥1 method" as a hard gate — that enforcement is the
 * Phase-05 LISTING-PUBLISH gate, not this settings page. Do not repurpose
 * this banner as the enforcement point.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnStorePayments, whose @/lib/supabase/server import would
// leak next/headers into this client bundle (T06 precedent).
import { updateStorePayments } from "@/features/store-management/actions/updateStorePayments";
import type { StorePaymentMethods } from "@/types/jsonb";
import { Alert, Toggle } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "../../_components/Field";

interface PaymentsFormValues {
  instapayHandle: string;
  vodafoneCash: string;
  orangeCash: string;
  codEnabled: boolean;
}

interface Props {
  payments: StorePaymentMethods;
}

/** Trim; empty → undefined (so an optional field is truly absent, not ""). */
function str(v: string): string | undefined {
  const t = v.trim();
  return t === "" ? undefined : t;
}

function toFormValues(p: StorePaymentMethods): PaymentsFormValues {
  return {
    instapayHandle: p.instapay_handle ?? "",
    vodafoneCash: p.vodafone_cash ?? "",
    orangeCash: p.orange_cash ?? "",
    codEnabled: p.cod_enabled ?? false,
  };
}

export function PaymentsSettingsForm({ payments }: Props) {
  const t = useTranslations("seller.store");
  const router = useRouter();

  const [data, setData] = React.useState<PaymentsFormValues>(() => toFormValues(payments));
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const update = (patch: Partial<PaymentsFormValues>) => setData((prev) => ({ ...prev, ...patch }));

  const allEmpty =
    !data.instapayHandle.trim() && !data.vodafoneCash.trim() && !data.orangeCash.trim() && !data.codEnabled;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await updateStorePayments({
        instapay_handle: str(data.instapayHandle),
        vodafone_cash: str(data.vodafoneCash),
        orange_cash: str(data.orangeCash),
        cod_enabled: data.codEnabled || undefined,
      });

      if (res.ok) {
        toast.success(t("payments.saved"));
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
          setFormError(t("payments.saveFailed"));
      }
    } catch {
      setFormError(t("payments.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <Alert variant="info" message={t("payments.note")} />

      <Field htmlFor="instapay" label={t("payments.instapayLabel")}>
        <Input
          id="instapay"
          value={data.instapayHandle}
          onChange={(e) => update({ instapayHandle: e.target.value })}
          maxLength={100}
          placeholder={t("payments.instapayPlaceholder")}
          dir="ltr"
        />
      </Field>

      <Field htmlFor="vodafone" label={t("payments.vodafoneLabel")}>
        <Input
          id="vodafone"
          value={data.vodafoneCash}
          onChange={(e) => update({ vodafoneCash: e.target.value })}
          maxLength={20}
          placeholder={t("payments.vodafonePlaceholder")}
          dir="ltr"
          inputMode="tel"
        />
      </Field>

      <Field htmlFor="orange" label={t("payments.orangeLabel")}>
        <Input
          id="orange"
          value={data.orangeCash}
          onChange={(e) => update({ orangeCash: e.target.value })}
          maxLength={20}
          placeholder={t("payments.orangePlaceholder")}
          dir="ltr"
          inputMode="tel"
        />
      </Field>

      <div className="rounded-md border border-border p-4">
        <Toggle
          id="cod"
          label={t("payments.codLabel")}
          checked={data.codEnabled}
          onCheckedChange={(v) => update({ codEnabled: v })}
        />
      </div>

      {/* R-S09 is config + banner ONLY here — see the file-header note. The
          Phase-05 listing-publish gate is the actual enforcement point. */}
      {allEmpty && <Alert variant="warning" message={t("payments.emptyWarning")} />}

      {formError && <Alert variant="destructive" message={formError} />}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("payments.saving") : t("payments.save")}
        </Button>
      </div>
    </form>
  );
}
