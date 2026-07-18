"use client";

/**
 * EmptyGettingStarted — platform-wide empty state (zero active listings
 * anywhere), per UI Spec §Homepage: "BETK is just getting started" panel +
 * Become-a-Seller CTA. Links straight to `/seller/onboarding` (same pattern
 * the Footer's "openStore" link already uses) — the middleware gate itself
 * redirects an unauthenticated click to `/auth/login?returnUrl=...`
 * (locale-preserving), so no auth check is needed on the homepage itself.
 */

import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { EmptyState } from "@/components/shared";

export interface EmptyGettingStartedProps {
  title: string;
  message: string;
  ctaLabel: string;
}

export function EmptyGettingStarted({ title, message, ctaLabel }: EmptyGettingStartedProps) {
  const router = useRouter();

  return (
    <EmptyState
      variant="default"
      message={title}
      hint={message}
      action={{ label: ctaLabel, onClick: () => router.push(routes.seller.onboarding) }}
    />
  );
}
