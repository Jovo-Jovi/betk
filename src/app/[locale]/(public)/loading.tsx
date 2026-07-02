/**
 * (public) loading state — shown by React Suspense during navigation within the
 * public route group (homepage + future discovery/listing/detail pages).
 *
 * OD-7: relocated here from [locale]/loading.tsx. Living inside the (public)
 * group means this boundary streams ONLY for real public pages and never wraps
 * the [locale]/[...rest] catch-all, so unknown paths keep a hard 404.
 * UI_STATE_STANDARDS.md: use skeleton for navigation loads, not a spinner.
 * TODO(Phase DS): replace EmptyState with a real skeleton layout.
 */
import { EmptyState } from "@/components/shared/EmptyState";

export default function PublicLoading() {
  return <EmptyState message="جارٍ التحميل…" />;
}
