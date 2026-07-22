"use client";

/**
 * MarkThreadRead — fires `markInquiryRead` on mount (Phase 06 / T03, REG-42
 * CLOSED). MUST be a client component: a Server Action mutation must never run
 * during a GET/RSC render — the thread page's `getInquiryThread` render stays a
 * pure read. This component renders nothing; it exists purely for the mount
 * side-effect.
 *
 * `markInquiryRead` is imported by FILE PATH (never the messaging barrel — the
 * barrel also re-exports `next/headers`-backed queries).
 *
 * NON-BLOCKING BY DESIGN: the thread has already rendered (with whatever
 * `isRead` state `getInquiryThread` returned for this request) — a mark-read
 * failure is swallowed silently, never surfaced to the buyer. No
 * `router.refresh()` on success either: refreshing would re-fetch the thread
 * and flip the just-read bubbles' styling under the buyer's eyes for no
 * visible benefit; the INBOX LIST re-reads (and drops the unread count) on its
 * own next navigation, which is the intended propagation point.
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
