"use client";

/**
 * ReturnsSettingsForm — Phase 04 / T07 (FR-SEL-6). Composes the kit + ui
 * primitives for the /seller/store/returns form. No new styled DS components
 * — a genuinely new component/state → STOP-and-flag to Claude Design.
 *
 * NULL DISCIPLINE: an empty textarea saves `return_policy = NULL` (per schema
 * `TEXT NULL`), never an empty string — the action performs this collapse.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
// Import the action directly (NOT the feature barrel) — the barrel also
// re-exports getOwnStoreReturns, whose @/lib/supabase/server import would
// leak next/headers into this client bundle (T06 precedent).
import { updateStoreReturns } from "@/features/store-management/actions/updateStoreReturns";
import { Alert } from "@/components/shared";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "../../_components/Field";

interface Props {
  returnPolicy: string;
}

const MAX_LENGTH = 2000;

export function ReturnsSettingsForm({ returnPolicy }: Props) {
  const t = useTranslations("seller.store");
  const router = useRouter();

  const [value, setValue] = React.useState(returnPolicy);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (value.trim().length > MAX_LENGTH) {
      setError(t("returns.errors.invalid"));
      return;
    }
    setError(null);
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await updateStoreReturns({ returnPolicy: value.trim() || undefined });

      if (res.ok) {
        toast.success(t("returns.saved"));
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
        case "invalid":
          setError(t("returns.errors.invalid"));
          break;
        default:
          setFormError(t("returns.saveFailed"));
      }
    } catch {
      setFormError(t("returns.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <Field htmlFor="returnPolicy" label={t("returns.label")} hint={error ? undefined : t("returns.hint")} error={error ?? undefined}>
        <Textarea
          id="returnPolicy"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          maxLength={MAX_LENGTH}
          rows={8}
          placeholder={t("returns.placeholder")}
        />
      </Field>

      {formError && <Alert variant="destructive" message={formError} />}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("returns.saving") : t("returns.save")}
        </Button>
      </div>
    </form>
  );
}
