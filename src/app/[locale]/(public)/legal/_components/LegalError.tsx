"use client";

import { useRouter } from "@/i18n/navigation";
import { ErrorRetryCard } from "@/components/shared/ErrorRetryCard";

/** Reloads the legal page. The kit card already owns the retry control. */
export function LegalError({
  message,
  retryLabel,
}: {
  message: string;
  retryLabel: string;
}) {
  const router = useRouter();
  return (
    <ErrorRetryCard
      message={message}
      retryLabel={retryLabel}
      onRetry={() => router.refresh()}
    />
  );
}
