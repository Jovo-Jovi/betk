"use client";

/**
 * Root error boundary — caught by Next.js when a Server Component or
 * client subtree throws during render.
 * UI_STATE_STANDARDS.md: page-level retry only when the primary resource fails.
 * TODO(Phase DS): replace ErrorRetryCard with the styled version from Claude Design.
 */
import { useEffect } from "react";
import { ErrorRetryCard } from "@/components/shared/ErrorRetryCard";
import { captureError } from "@/services/sentry";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest });
  }, [error]);

  return (
    <ErrorRetryCard
      message="حدث خطأ غير متوقع. يرجى المحاولة مجدداً."
      onRetry={reset}
    />
  );
}
