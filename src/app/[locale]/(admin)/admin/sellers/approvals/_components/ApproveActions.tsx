"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { approveSellerApplication, rejectSellerApplication } from "@/features/seller-approval/actions/approveSellerApplication";

export function ApproveActions({
  sellerId,
  approveLabel,
  rejectLabel,
  reasonLabel,
  incompleteLabel,
  forbiddenLabel,
  refusedLabel,
}: {
  sellerId: string;
  approveLabel: string;
  rejectLabel: string;
  reasonLabel: string;
  incompleteLabel: string;
  forbiddenLabel: string;
  refusedLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function fail(result: { ok: false; reason: string }): void {
    if (result.reason === "incomplete") setMessage(incompleteLabel);
    else if (result.reason === "forbidden") setMessage(forbiddenLabel);
    else setMessage(refusedLabel);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await approveSellerApplication({ sellerId });
            if (!result.ok) {
              fail(result);
              return;
            }
            router.refresh();
          });
        }}
      >
        {approveLabel}
      </Button>
      <label className="flex flex-col gap-1 text-sm">
        {reasonLabel}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={pending || reason.trim().length === 0}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await rejectSellerApplication({ sellerId, reason });
            if (!result.ok) {
              fail(result);
              return;
            }
            router.refresh();
          });
        }}
      >
        {rejectLabel}
      </Button>
      {message ? <p role="alert">{message}</p> : null}
    </div>
  );
}
