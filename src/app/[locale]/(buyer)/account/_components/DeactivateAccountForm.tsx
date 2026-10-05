"use client";

/**
 * DeactivateAccountForm — explicit account deactivation (OD-2).
 *
 * ConfirmDialog is the confirmation. Confirming submits the same action
 * with the same field: `confirm=DEACTIVATE`. deactivateAccount reads
 * formData.get("confirm") (src/features/buyer-account/actions/deactivateAccount.ts).
 *
 * On success the Server Action signs the user out and redirects to a public
 * page, so this form only ever renders an error on failure.
 *
 * REG-59 compose (decision 2026-10-05).
 */

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deactivateAccount } from "@/features/buyer-account/actions/deactivateAccount";
import type { DeactivateAccountResult } from "@/features/buyer-account/actions/deactivateAccount";
import { Alert, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";

export function DeactivateAccountForm() {
  const t = useTranslations("account.deactivate");
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DeactivateAccountResult | null,
    FormData
  >(deactivateAccount, null);

  function handleConfirm() {
    formRef.current?.requestSubmit();
  }

  return (
    <div data-slot="deactivate-account" className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-bold text-foreground">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      <Button
        type="button"
        variant="destructive"
        data-slot="deactivate-reveal-btn"
        onClick={() => setOpen(true)}
      >
        {t("revealButton")}
      </Button>

      {state?.errorAr && !open ? (
        <div role="alert" data-slot="error-msg">
          <Alert variant="destructive" message={state.errorAr} />
        </div>
      ) : null}

      <form ref={formRef} action={formAction} data-slot="deactivate-form" hidden>
        <div data-slot="field">
          <input type="hidden" id="confirm-deactivate" name="confirm" value="DEACTIVATE" />
        </div>
        <div data-slot="deactivate-actions">
          <button
            type="button"
            data-slot="deactivate-cancel-btn"
            onClick={() => setOpen(false)}
            disabled={isPending}
          />
          <button type="submit" data-slot="deactivate-confirm-btn" disabled={isPending} />
        </div>
      </form>

      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (isPending) return;
          setOpen(next);
        }}
        title={t("title")}
        confirmLabel={isPending ? t("processing") : t("confirmButton")}
        cancelLabel={t("cancel")}
        destructive
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (isPending) return;
          setOpen(false);
        }}
      >
        <span className="block">
          {t("confirmLabel")}
          {state?.errorAr ? (
            <span role="alert" data-slot="error-msg" className="mt-2 block text-destructive">
              {state.errorAr}
            </span>
          ) : null}
        </span>
      </ConfirmDialog>
    </div>
  );
}
