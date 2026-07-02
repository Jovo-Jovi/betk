"use client";

/**
 * Root error boundary — caught by Next.js when a Server Component or
 * client subtree throws during render.
 * UI_STATE_STANDARDS.md: page-level retry only when the primary resource fails.
 * OD-7 / BL-04: ErrorRetryCard now takes `retryLabel` as a prop (DS-I18N) —
 * both it and the message are wired via next-intl (`common.retry` /
 * `errors.unexpectedError`) instead of a baked-in Arabic literal.
 */
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorRetryCard } from "@/components/shared/ErrorRetryCard";
import { captureError } from "@/services/sentry";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    captureError(error, { digest: error.digest });
  }, [error]);

  return (
    <ErrorRetryCard
      message={t("errors.unexpectedError")}
      retryLabel={t("common.retry")}
      onRetry={reset}
    />
  );
}
