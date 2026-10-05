/**
 * D1 (2026-10-05). Same markup as `[locale]/not-found.tsx` (EmptyState + Link,
 * `notFound.*` keys). This file is the nearest boundary for `notFound()` thrown
 * inside `(public)`, so the public layout (top bar + footer) wraps it. The 404
 * status and R-S07 stay unchanged. `[locale]/not-found.tsx` and
 * `app/global-not-found.tsx` are not this boundary.
 */
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <EmptyState variant="filtered" message={t("title")} hint={t("description")} />
      <Link href="/" className="text-sm font-medium text-primary underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
