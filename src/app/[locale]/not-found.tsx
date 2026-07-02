/**
 * Root 404 — rendered when notFound() is called or a route cannot be matched.
 * UI_STATE_STANDARDS.md: use EmptyState with a CTA toward a useful destination.
 * TODO(Phase DS): replace EmptyState with the styled version from Claude Design.
 */
import { EmptyState } from "@/components/shared/EmptyState";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div>
      <EmptyState message="الصفحة التي تبحث عنها غير موجودة." />
      {/* Locale-aware home link (OD-7): resolves to `/` (ar) or `/en` (en). */}
      <Link href="/">العودة إلى الرئيسية</Link>
    </div>
  );
}
