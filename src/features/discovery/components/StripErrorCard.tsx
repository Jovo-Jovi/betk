"use client";

/**
 * StripErrorCard — section-level error, one per independently-failed
 * homepage strip (categories / collections / new arrivals / boosted). Phase
 * 03 / T02 invariant: a failed strip never hard-fails the page.
 *
 * "Retry" re-runs this Server Component subtree via `router.refresh()`
 * (plain next/navigation — no URL change, so locale awareness doesn't apply)
 * rather than a client-side re-fetch: Phase 03 has no read Server Actions/
 * route handlers for these queries (public reads only, T01 invariant), so
 * `refresh()` is the idiomatic App Router way to retry an RSC data fetch.
 */

import { useRouter } from "next/navigation";
import { ErrorRetryCard } from "@/components/shared";

export interface StripErrorCardProps {
  message: string;
  retryLabel: string;
  compact?: boolean;
  className?: string;
}

export function StripErrorCard({ message, retryLabel, compact, className }: StripErrorCardProps) {
  const router = useRouter();

  return (
    <ErrorRetryCard
      message={message}
      retryLabel={retryLabel}
      compact={compact}
      className={className}
      onRetry={() => router.refresh()}
    />
  );
}
