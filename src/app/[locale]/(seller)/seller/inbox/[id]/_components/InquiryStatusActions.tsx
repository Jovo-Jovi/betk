"use client";

/**
 * InquiryStatusActions — CONFIRM + DECLINE, the seller-only status
 * transitions (Phase 06 / T04, FR-SEL-13). Both actions are BUILT (T02
 * shipped `declineInquiry` too — UI_SPEC L481 pins the decline surface, not
 * just confirm) and wired identically: a `ConfirmDialog` gate before the
 * mutation, `router.refresh()` on success so the page's own `getInquiryThread`
 * read reflects the new status (and the confirmed-state banner appears)
 * without any client-side status state to keep in sync by hand (the
 * `ListingsList` precedent).
 *
 * Both actions are imported by FILE PATH (never the messaging barrel — the
 * barrel also re-exports the `next/headers`-backed queries).
 *
 * VISIBILITY: hidden once the inquiry is already in a terminal state
 * (confirmed/declined/expired) — a UI-only pre-check; T02's own guards
 * (`confirmInquiry`/`declineInquiry`) are idempotent/invalid_state-typed
 * regardless, so a stale render can never double-transition.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { confirmInquiry } from "@/features/messaging/actions/confirmInquiry";
import { declineInquiry } from "@/features/messaging/actions/declineInquiry";
import type { Database } from "@/lib/supabase/types";

type InquiryStatus = Database["betk"]["Enums"]["inquiry_status"];

export interface InquiryStatusActionsProps {
  inquiryId: string;
  status: InquiryStatus;
}

export function InquiryStatusActions({ inquiryId, status }: InquiryStatusActionsProps) {
  const t = useTranslations("seller.inbox.thread");
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"confirm" | "decline" | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const isTerminal = status === "confirmed" || status === "declined" || status === "expired";
  if (isTerminal) return null;

  function handleFailure(reason: string, kind: "confirmAction" | "declineAction") {
    if (reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (reason === "blocked") {
      router.push("/blocked");
      return;
    }
    if (reason === "not_found") {
      toast.error(t(`${kind}.notFound`));
      return;
    }
    if (reason === "invalid_state") {
      toast.error(t(`${kind}.invalidState`));
      router.refresh();
      return;
    }
    toast.error(t(`${kind}.failed`));
  }

  async function runConfirm() {
    setIsPending(true);
    try {
      const res = await confirmInquiry({ inquiryId });
      if (res.ok) {
        toast.success(t("confirmAction.success"));
        setDialog(null);
        router.refresh();
        return;
      }
      handleFailure(res.reason, "confirmAction");
    } finally {
      setIsPending(false);
    }
  }

  async function runDecline() {
    setIsPending(true);
    try {
      const res = await declineInquiry({ inquiryId });
      if (res.ok) {
        toast.success(t("declineAction.success"));
        setDialog(null);
        router.refresh();
        return;
      }
      handleFailure(res.reason, "declineAction");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setDialog("confirm")}>
        {t("confirmAction.label")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setDialog("decline")}
      >
        {t("declineAction.label")}
      </Button>

      <ConfirmDialog
        open={dialog === "confirm"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("confirmAction.dialogTitle")}
        message={t("confirmAction.dialogMessage")}
        confirmLabel={t("confirmAction.confirmLabel")}
        cancelLabel={t("confirmAction.cancelLabel")}
        loading={isPending}
        onConfirm={runConfirm}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "decline"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("declineAction.dialogTitle")}
        message={t("declineAction.dialogMessage")}
        confirmLabel={t("declineAction.confirmLabel")}
        cancelLabel={t("declineAction.cancelLabel")}
        destructive
        loading={isPending}
        onConfirm={runDecline}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
