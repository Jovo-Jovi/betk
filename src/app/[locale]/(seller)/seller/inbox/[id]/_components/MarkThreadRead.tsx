"use client";

/**
 * MarkThreadRead — fires `markInquiryRead` on mount (Phase 06 / T04, REG-42
 * CLOSED). Duplicated verbatim from the buyer-side `/inbox/[id]` component
 * (Phase 06 / T03) — `(buyer)`/`(seller)` route-group private `_components/`
 * folders can't share a file across groups; this repo already duplicates
 * per-folder helpers the same way (e.g. `Field.tsx` under every seller
 * sub-route). MUST be a client component: a Server Action mutation must
 * never run during a GET/RSC render — the thread page's `getInquiryThread`
 * render stays a pure read.
 *
 * `markInquiryRead` is imported by FILE PATH (never the messaging barrel —
 * the barrel also re-exports the `next/headers`-backed queries).
 *
 * NON-BLOCKING BY DESIGN, no `router.refresh()` on success — see the T03
 * component's header for the full rationale (unchanged here): the INBOX LIST
 * re-reads (and drops the unread count) on its own next navigation.
 */

import { useEffect, useRef } from "react";
import { markInquiryRead } from "@/features/messaging/actions/markInquiryRead";

export interface MarkThreadReadProps {
  inquiryId: string;
  /** Skip the call entirely when the thread has nothing unread (optimization). */
  hasUnread: boolean;
}

export function MarkThreadRead({ inquiryId, hasUnread }: MarkThreadReadProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!hasUnread || firedRef.current) return;
    firedRef.current = true;
    markInquiryRead({ inquiryId }).catch(() => {
      // Non-blocking (see header note) — the thread already rendered.
    });
  }, [inquiryId, hasUnread]);

  return null;
}
