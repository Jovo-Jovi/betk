/**
 * (auth) loading state — shown by React Suspense during navigation within the
 * auth route group (login / verify / register / phone).
 *
 * OD-7: relocated here from [locale]/loading.tsx so auth pages keep their
 * Suspense UX without the boundary wrapping the [locale]/[...rest] catch-all.
 * TODO(Phase DS): replace EmptyState with a real skeleton layout.
 */
import { EmptyState } from "@/components/shared/EmptyState";

export default function AuthLoading() {
  return <EmptyState message="جارٍ التحميل…" />;
}
