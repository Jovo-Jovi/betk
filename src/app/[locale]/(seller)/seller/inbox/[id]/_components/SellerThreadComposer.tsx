"use client";

/**
 * SellerThreadComposer — composes the shared `MessageThread` AS-IS against
 * `getInquiryThread`'s merged `messages` list (Phase 06 / T04). Mirrors the
 * buyer-side `ThreadComposer` (T03) with ONE difference: `sent` (the "is this
 * bubble mine" alignment flag passed to `MessageThread`) checks
 * `senderType === "seller"` here instead of `"buyer"` — computed by the
 * calling page, not this component, so this file is otherwise byte-identical
 * to its buyer counterpart including the `readOnly` composition strategy.
 *
 * `sendInquiryMessage` is imported by FILE PATH (never the messaging barrel).
 *
 * `readOnly` (declined/expired — T03 carry, closes it): the shared
 * `MessageThread` (frozen kit) has no `disabled`/`readOnly` prop, so
 * compose-only forbids patching one in. T03 shipped the composer ENABLED
 * with a toast-on-submit for this state — this task's flagged micro-fix
 * disables the input outright instead (2-line change: `disabled` on the
 * underlying input isn't exposed either, so the fix is at THIS layer — when
 * `readOnly`, the input value is frozen and `onComposerChange`/`onSend` are
 * both no-ops, with the existing neutral keyed line rendered by the caller
 * above). No kit edit.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { MessageThread, type ThreadMessage } from "@/components/shared";
import { sendInquiryMessage } from "@/features/messaging/actions/sendInquiryMessage";

export interface SellerThreadComposerProps {
  inquiryId: string;
  messages: ThreadMessage[];
  composerPlaceholder: string;
  sendLabel: string;
  emptyMessage: string;
  sendErrorMessage: string;
  readOnly: boolean;
  /** Shown via toast if the seller tries to send on a closed (readOnly) thread. */
  closedMessage: string;
}

export function SellerThreadComposer({
  inquiryId,
  messages,
  composerPlaceholder,
  sendLabel,
  emptyMessage,
  sendErrorMessage,
  readOnly,
  closedMessage,
}: SellerThreadComposerProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  if (readOnly) {
    return (
      <MessageThread
        messages={messages}
        composerValue={value}
        onComposerChange={() => {
          // Frozen — the closed-state banner above already explains why.
        }}
        onSend={() => toast.error(closedMessage)}
        composerPlaceholder={composerPlaceholder}
        sendLabel={sendLabel}
        emptyMessage={emptyMessage}
      />
    );
  }

  const handleSend = (raw: string) => {
    const body = raw.trim();
    if (!body || isPending) return;

    startTransition(async () => {
      const res = await sendInquiryMessage({ inquiryId, body });
      if (res.ok) {
        setValue("");
        router.refresh();
        return;
      }
      toast.error(sendErrorMessage);
    });
  };

  return (
    <MessageThread
      messages={messages}
      composerValue={value}
      onComposerChange={setValue}
      onSend={handleSend}
      composerPlaceholder={composerPlaceholder}
      sendLabel={sendLabel}
      emptyMessage={emptyMessage}
    />
  );
}
