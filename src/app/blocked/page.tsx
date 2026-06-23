import { EmptyState } from "@/components/shared/EmptyState";

/**
 * /blocked — terminal page for suspended / banned / deactivated accounts (R-A05).
 * Middleware routes blocked users here on every protected request. Public gate so it
 * never loops. Minimal placeholder — TODO(Phase DS): real blocked-account visual + copy
 * (support contact, reactivation path) per UI_STATE_STANDARDS.md.
 */
export default function BlockedPage() {
  return (
    <main data-slot="blocked-page">
      <EmptyState message="تم تعليق هذا الحساب. تواصل مع الدعم للمزيد من المعلومات." />
    </main>
  );
}
