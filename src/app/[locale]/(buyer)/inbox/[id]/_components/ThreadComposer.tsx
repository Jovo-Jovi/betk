"use client";

/**
 * ThreadComposer — composes the shared `MessageThread` AS-IS (Phase 06 / T03,
 * FR-BUY-5) against `getInquiryThread`'s merged `messages` list (the T03
 * query-layer merge — `messages[0]` is already the opening `buyerFirstMessage`
 * bubble, so no splicing happens here).
 *
 * `sendInquiryMessage` is imported by FILE PATH (never the messaging barrel —
 * the T03/T04-Phase-05 barrel-leak precedent: the barrel also re-exports
 * `next/headers`-backed queries).
 *
 * On success: `router.refresh()` re-runs the RSC page's `getInquiryThread`
 * read, so the new bubble (and any status transition it triggered, e.g.
 * open→replied) lands via fresh server data — no client-side message-list
 * state to keep in sync by hand (StoreProfileForm/ListingForm precedent).
 *
 * `readOnly` (declined/expired — BETK_UI_SPEC.md L226 "declined/expired
 * inquiry (read-only)"): `MessageThread` (frozen kit) has no `disabled`/
 * `readOnly` prop to suppress its composer — patching that in would violate
 * compose-only (never restyle/extend `components/shared/*` in-repo; a real
 * gap goes to Claude Design, not an in-repo patch). T04-CARRY MICRO-FIX
 * (Phase 06 / T04): the input is now FROZEN instead of usable-with-a-toast —
 * `onComposerChange` is a no-op (the controlled `composerValue` never
 * changes, so keystrokes have no visible effect) and `onSend` still guards
 * with a toast as a defence-in-depth backstop (no mutation ever fires for a
 * closed inquiry either way). The caller additionally renders the
 * closed-state banner (`inbox.thread.closedBanner`) above this.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { MessageThread, type ThreadMessage } from "@/components/shared";
import { sendInquiryMessage } from "@/features/messaging/actions/sendInquiryMessage";

export interface ThreadComposerProps {
  inquiryId: string;
  messages: ThreadMessage[];
  composerPlaceholder: string;
  sendLabel: string;
  emptyMessage: string;
  sendErrorMessage: string;
  readOnly: boolean;
  /** Shown via toast if the buyer tries to send on a closed (readOnly) thread. */
  closedMessage: string;
}

export function ThreadComposer({
  inquiryId,
  messages,
  composerPlaceholder,
  sendLabel,
  emptyMessage,
  sendErrorMessage,
  readOnly,
  closedMessage,
}: ThreadComposerProps) {
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
