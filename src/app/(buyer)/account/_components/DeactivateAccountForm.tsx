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
import { deactivateAccount } from "@/features/buyer-account/actions/deactivateAccount";
import type { DeactivateAccountResult } from "@/features/buyer-account/actions/deactivateAccount";

export function DeactivateAccountForm() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DeactivateAccountResult | null,
    FormData
  >(deactivateAccount, null);

  return (
    <div data-slot="deactivate-account" dir="rtl">
      <h2>تعطيل الحساب</h2>
      <p>
        تعطيل الحساب يمنعك من تسجيل الدخول أو إجراء أي معاملات. لن يتم حذف بياناتك،
        ويمكن إعادة تفعيل الحساب لاحقًا عبر الدعم.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          data-slot="deactivate-reveal-btn"
          onClick={() => setShowConfirm(true)}
        >
          تعطيل حسابي
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
              أؤكد رغبتي في تعطيل حسابي وتسجيل الخروج.
            </label>
          </div>

          <div data-slot="deactivate-actions">
            <button
              type="button"
              data-slot="deactivate-cancel-btn"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-slot="deactivate-confirm-btn"
              disabled={isPending}
            >
              {isPending ? "جارٍ التعطيل…" : "تأكيد التعطيل"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
