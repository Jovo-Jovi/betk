"use client";

/**
 * InboxEmptyState — "no inquiries yet" + browse CTA (BETK_UI_SPEC.md L227).
 * A thin client wrapper so the RSC `/inbox` page can use `EmptyState`'s
 * `action` (onClick) prop (`EmptyGettingStarted` precedent, Phase 03).
 */

import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { EmptyState } from "@/components/shared";

export interface InboxEmptyStateProps {
  message: string;
  hint: string;
  ctaLabel: string;
}

export function InboxEmptyState({ message, hint, ctaLabel }: InboxEmptyStateProps) {
  const router = useRouter();

  return (
    <EmptyState
      variant="default"
      message={message}
      hint={hint}
      action={{ label: ctaLabel, onClick: () => router.push(routes.home) }}
    />
  );
}
