/**
 * CategoryListingsSection — the listings grid for `/category/[slug]`.
 * PERF-01 (streaming) + PERF-02 (ISR + off-URL pagination).
 *
 * Fetches page 1 of `getActiveListings` (T04) via the stateless anon client
 * and renders the error / empty states, or hands page 1 to `CategoryLoadMore`
 * (client) which renders the grid and appends further pages in place. The page
 * wraps this in a `<Suspense>` boundary (`SkeletonGrid` fallback, homepage
 * CategoriesSection/HomeStripsSection precedent) so the header + subcategory
 * chips paint after the cheap `getCategoryBySlug` read while this section's own
 * listings fetch streams in — on the ISR MISS path (first hit / revalidation).
 * On a cache HIT the whole page is already-materialised HTML (no streaming).
 *
 * PERF-02: pagination no longer rides `?cursor=` (a page-level `searchParams`
 * read would force the route dynamic and defeat ISR — the same reason
 * `/search` stays dynamic). This section fetches ONLY page 1 (no cursor); the
 * "load more" append is a client → `GET /api/category-listings` round-trip
 * owned by `CategoryLoadMore`.
 *
 * BINDING RULE: the category-existence check (`getCategoryBySlug` +
 * `notFound()`) stays at the page's top level, OUTSIDE this boundary — a
 * `notFound()`-capable decision must never sit behind a Suspense boundary that
 * could stream a 200 shell before it resolves (BL-01-FIX/T04). This section
 * only ever renders once that decision has already committed.
 *
 * Reads go through the stateless anon client (no `cookies()`), so the whole
 * miss-path render stays ISR-compatible (the cookie client's `cookies()` call
 * would force per-request dynamic rendering).
 *
 * PERF-02 locale handling: this is an async server component rendered INSIDE a
 * `<Suspense>` boundary, i.e. neither a page nor a layout — the two scopes
 * next-intl's `setRequestLocale` cache() store is guaranteed for. During
 * runtime on-demand ISR generation of a NON-default locale that store is not
 * resolved here, so `getTranslations()` / `getLocale()` (and next-intl's server
 * `<Link>`) would fall back to `headers()` and abort generation with
 * DYNAMIC_SERVER_USAGE (the default locale is silently masked by next-intl's
 * fallback). We therefore take `locale` as a prop (from the page's validated
 * `[locale]` segment) and pass it EXPLICITLY to every `getTranslations({locale})`
 * and to the `<Link locale>` — the next-intl-documented way to keep a route
 * statically renderable without depending on the request store.
 */

import { getTranslations } from "next-intl/server";
import { getActiveListings } from "@/features/discovery";
import type { ListingPage } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { Link } from "@/i18n/navigation";
import { catalogListingBoostLabel } from "@/i18n/catalogLabels";
import { EmptyState } from "@/components/shared";
import { StripErrorCard } from "./StripErrorCard";
import { CategoryLoadMore } from "./CategoryLoadMore";

interface ParentInfo {
  slug: string;
  name: string;
}

export async function CategoryListingsSection({
  categoryId,
  categoryName,
  parent,
  locale,
}: {
  categoryId: string;
  categoryName: string;
  parent: ParentInfo | null;
  locale: AppLocale;
}) {
  const t = await getTranslations({ locale, namespace: "category" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const catalogT = await getTranslations({ locale, namespace: "catalog" });
  const tListing = await getTranslations({ locale, namespace: "listing" });

  const boostLabel = catalogListingBoostLabel(catalogT);
  const wishlistLabels = { addLabel: tListing("wishlist.add"), removeLabel: tListing("wishlist.remove") };

  const supabase = createAnonClient();
  let page: ListingPage = { items: [], nextCursor: null };
  let isError = false;
  try {
    page = await getActiveListings({ category: categoryId }, supabase);
  } catch {
    isError = true;
  }

  if (isError) {
    return <StripErrorCard message={t("error")} retryLabel={tCommon("retry")} />;
  }

  if (page.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card py-4">
        <EmptyState variant="default" message={t("empty.message", { name: categoryName })} />
        <div className="flex flex-wrap items-center justify-center gap-4 pb-4">
          {parent && (
            <Link
              href={routes.category(parent.slug)}
              locale={locale}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("empty.backToParent", { name: parent.name })}
            </Link>
          )}
          <Link
            href={routes.home}
            locale={locale}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tCommon("backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CategoryLoadMore
      categoryId={categoryId}
      locale={locale}
      initialItems={page.items}
      initialCursor={page.nextCursor}
      boostLabel={boostLabel}
      wishlistAddLabel={wishlistLabels.addLabel}
      wishlistRemoveLabel={wishlistLabels.removeLabel}
      loadMoreLabel={t("loadMore")}
      retryLabel={tCommon("retry")}
      errorLabel={t("error")}
    />
  );
}
