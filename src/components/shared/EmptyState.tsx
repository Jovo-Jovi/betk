/**
 * EmptyState — minimal unstyled placeholder.
 * TODO(Phase DS): Replace with Claude Design system component.
 * Spec: UI_STATE_STANDARDS.md — one-line Arabic copy + single CTA.
 */
export interface EmptyStateProps {
  /** Short Arabic explanation shown to the user. */
  message?: string;
  /** Optional CTA label. */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ message = "لا توجد بيانات", action }: EmptyStateProps) {
  return (
    <div data-slot="empty-state">
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
