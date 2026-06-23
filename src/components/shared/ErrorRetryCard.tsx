/**
 * ErrorRetryCard — minimal unstyled placeholder.
 * TODO(Phase DS): Replace with Claude Design system component.
 * Spec: UI_STATE_STANDARDS.md — section-level error with retry CTA.
 */
export interface ErrorRetryCardProps {
  /** Non-technical Arabic error message. */
  message?: string;
  /** Called when the user taps "retry". */
  onRetry?: () => void;
}

export function ErrorRetryCard({
  message = "حدث خطأ ما، يرجى المحاولة مجدداً.",
  onRetry,
}: ErrorRetryCardProps) {
  return (
    <div data-slot="error-retry-card" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
