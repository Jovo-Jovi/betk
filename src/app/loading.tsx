/**
 * Root loading state — shown by React Suspense during top-level navigation.
 * UI_STATE_STANDARDS.md: use skeleton for navigation loads, not a spinner.
 * TODO(Phase DS): replace EmptyState with a real skeleton layout once Claude
 * Design delivers the skeleton tokens.
 */
import { EmptyState } from "@/components/shared/EmptyState";

export default function RootLoading() {
  return <EmptyState message="جارٍ التحميل…" />;
}
