"use client";

/**
 * Decline only. P10 T04 removed the confirm-to-checkout control (P37).
 * Decline stays. File-path action import.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const isTerminal = status === "confirmed" || status === "declined" || status === "expired";
  if (isTerminal) return null;

  function handleFailure(reason: string) {
    if (reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (reason === "blocked") {
      router.push("/blocked");
      return;
    }
    if (reason === "not_found") {
      toast.error(t("declineAction.notFound"));
      return;
    }
    if (reason === "invalid_state") {
      toast.error(t("declineAction.invalidState"));
      router.refresh();
      return;
    }
    toast.error(t("declineAction.failed"));
  }

  async function runDecline() {
    setIsPending(true);
    try {
      const res = await declineInquiry({ inquiryId });
      if (res.ok) {
        toast.success(t("declineAction.success"));
        setOpen(false);
        router.refresh();
        return;
      }
      handleFailure(res.reason);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {t("declineAction.label")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => !next && setOpen(false)}
        title={t("declineAction.dialogTitle")}
        message={t("declineAction.dialogMessage")}
        confirmLabel={t("declineAction.confirmLabel")}
        cancelLabel={t("declineAction.cancelLabel")}
        destructive
        loading={isPending}
        onConfirm={runDecline}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
