/**
 * Localized 404 (REG-28). Rendered when notFound() is called from WITHIN a
 * matched route inside the [locale] segment — e.g. a listing/category/store
 * detail page whose record doesn't exist. Composes with [locale]/layout.tsx so
 * it inherits the correct <html lang/dir> + NextIntl context.
 *
 * Truly-unmatched URLs (/xx, /does-not-exist, bad locale prefix) are handled at
 * the routing level by app/global-not-found.tsx instead (see next.config.ts).
 *
 * Kit components only (EmptyState + shared Link) — no bespoke 404 design.
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
