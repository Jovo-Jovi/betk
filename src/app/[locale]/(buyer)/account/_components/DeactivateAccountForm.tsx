"use client";

/**
 * DeactivateAccountForm — explicit, two-step account deactivation (OD-2).
 *
 * Step 1: a "deactivate account" button reveals the confirmation panel.
 * Step 2: the user must tick the confirmation checkbox (which carries the
 *   literal token the Server Action's Zod schema requires) and press confirm.
 *
 * On success the Server Action signs the user out and redirects to a public
 * page, so this form only ever renders an error on failure.
 *
 * Phase 02 / T06.
 * TODO(Phase DS): restyle with Claude Design system components (AlertDialog).
 */

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deactivateAccount } from "@/features/buyer-account/actions/deactivateAccount";
import type { DeactivateAccountResult } from "@/features/buyer-account/actions/deactivateAccount";

export function DeactivateAccountForm() {
  const t = useTranslations("account.deactivate");
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DeactivateAccountResult | null,
    FormData
  >(deactivateAccount, null);

  return (
    <div data-slot="deactivate-account">
      <h2>{t("title")}</h2>
      <p>{t("description")}</p>

      {!showConfirm ? (
        <button
          type="button"
          data-slot="deactivate-reveal-btn"
          onClick={() => setShowConfirm(true)}
        >
          {t("revealButton")}
        </button>
      ) : (
        <form action={formAction} data-slot="deactivate-form">
          {state?.errorAr && (
            <p role="alert" data-slot="error-msg">
              {state.errorAr}
            </p>
          )}

          <div data-slot="field">
            <label htmlFor="confirm-deactivate">
              <input
                id="confirm-deactivate"
                name="confirm"
                type="checkbox"
                value="DEACTIVATE"
                required
                disabled={isPending}
              />{" "}
              {t("confirmLabel")}
            </label>
          </div>

          <div data-slot="deactivate-actions">
            <button
              type="button"
              data-slot="deactivate-cancel-btn"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              data-slot="deactivate-confirm-btn"
              disabled={isPending}
            >
              {isPending ? t("processing") : t("confirmButton")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
