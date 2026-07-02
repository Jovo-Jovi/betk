/**
 * (buyer) loading state — shown by React Suspense while buyer content (e.g. the
 * account page's getProfile fetch) streams in.
 *
 * OD-7: relocated here from [locale]/loading.tsx so authenticated buyer pages
 * keep their Suspense UX without the boundary wrapping the [locale]/[...rest]
 * catch-all.
 * TODO(Phase DS): replace EmptyState with a real skeleton layout.
 */
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function BuyerLoading() {
  const t = await getTranslations("common");
  return <EmptyState message={t("loading")} />;
}
