"use client";

/**
 * CancelOrderButton — the `/orders/[id]` cancel affordance (Phase 07 / T04,
 * R-O03: visible only while `status='pending'`). ConfirmDialog (kit) →
 * `cancelOrder` (file-path import, not the feature barrel — the barrel-leak
 * precedent) → `router.refresh()` so the server-rendered detail re-fetches
 * the post-cancel state (mirrors the `PauseListingButton`/accept-button
 * shape used elsewhere in the console surfaces).
 *
 * ⚠️ D6 UNANSWERED (flagged, not fixed here — Phase 07 T04 report /
 * SESSION_CONTEXT). CURRENT BEHAVIOUR: this button is gated ONLY on
 * `order.status === 'pending'` (R-O03, `isBuyerCancellable` /
 * `enforce_order_transition` — both DB-authoritative and this UX pre-check
 * agree). Neither layer looks at the DEPOSIT payment's status. So a buyer CAN
 * cancel a pending order whose deposit is ALREADY `payments.status='confirmed'`
 * (admin verified the transfer, but the SELLER has not yet accepted — that
 * window is exactly `pending` + deposit-confirmed). The money is already
 * custodied by BETK with no order left to fulfil it and NO MVP refund path
 * (`payments.status='refunded'` is Phase 10/14 — see the §0 table's "REJECT
 * the deposit?" row). If D6 resolves to "block cancel once the deposit is
 * confirmed", THIS is the single edit point: add `depositConfirmed` to the
 * gate below (`!depositConfirmed`) and to the `not_cancellable` messaging.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cancelOrder } from "@/features/orders/actions/cancelOrder";

export interface CancelOrderButtonProps {
  orderId: string;
}

export function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const t = useTranslations("orders.detail.cancel");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cancelOrder({ orderId });
      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(res.reason === "not_cancellable" ? t("errorNotCancellable") : t("errorGeneric"));
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t("cta")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle")}
        message={error ?? t("confirmMessage")}
        confirmLabel={t("confirmLabel")}
        cancelLabel={t("cancelLabel")}
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
