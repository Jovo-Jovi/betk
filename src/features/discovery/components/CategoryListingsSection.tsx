/**
 * CategoryListingsSection — the listings grid for `/category/[slug]`.
 * PERF-01 (streaming). Fetches `getActiveListings` (T01) via the stateless
 * anon client and renders the grid/empty/error states. The page wraps this
 * in a `<Suspense>` boundary (`SkeletonGrid` fallback, homepage
 * CategoriesSection/HomeStripsSection precedent) so the header + subcategory
 * chips paint after the cheap `getCategoryBySlug` read while this section's
 * own listings fetch streams in separately.
 *
 * BINDING RULE: the category-existence check (`getCategoryBySlug` +
 * `notFound()`) stays at the page's top level, OUTSIDE this boundary — a
 * `notFound()`-capable decision must never sit behind a Suspense boundary
 * that could stream a 200 shell before it resolves (BL-01-FIX/T04). This
 * section only ever renders once that decision has already committed.
 */

import { getTranslations, getLocale } from "next-intl/server";
import { getActiveListings } from "@/features/discovery";
import type { ListingPage } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { Link } from "@/i18n/navigation";
import { catalogListingBoostLabel } from "@/i18n/catalogLabels";
import { EmptyState } from "@/components/shared";
import { ListingCardLink } from "./ListingCardLink";
import { StripErrorCard } from "./StripErrorCard";
import { CategoryLoadMore } from "./CategoryLoadMore";

interface ParentInfo {
  slug: string;
  name: string;
}

export async function CategoryListingsSection({
  categoryId,
  categorySlug,
  categoryName,
  parent,
  cursor,
}: {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  parent: ParentInfo | null;
  cursor: string | undefined;
}) {
  const t = await getTranslations("category");
  const tCommon = await getTranslations("common");
  const catalogT = await getTranslations("catalog");
  const tListing = await getTranslations("listing");
  const locale = (await getLocale()) as AppLocale;

  const boostLabel = catalogListingBoostLabel(catalogT);
  const wishlistLabels = { addLabel: tListing("wishlist.add"), removeLabel: tListing("wishlist.remove") };

  const supabase = createAnonClient();
  let page: ListingPage = { items: [], nextCursor: null };
  let isError = false;
  try {
    page = await getActiveListings({ category: categoryId, cursor }, supabase);
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
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("empty.backToParent", { name: parent.name })}
            </Link>
          )}
          <Link
            href={routes.home}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tCommon("backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {page.items.map((listing) => (
          <ListingCardLink
            key={listing.id}
            id={listing.id}
            title={localizedName({ ar: listing.titleAr, en: listing.titleEn }, locale)}
            image={listing.heroImageUrl}
            price={listing.price}
            priceType={listing.priceType}
            storeName={
              listing.store
                ? localizedName({ ar: listing.store.nameAr, en: listing.store.nameEn }, locale)
                : null
            }
            rating={listing.store?.rating?.averageRating ?? null}
            reviews={listing.store?.rating?.totalReviews ?? null}
            boostLabel={boostLabel}
            wishlistAddLabel={wishlistLabels.addLabel}
            wishlistRemoveLabel={wishlistLabels.removeLabel}
            stockQty={listing.stockQty}
            isMadeToOrder={listing.isMadeToOrder}
            isService={listing.type === "service"}
          />
        ))}
      </div>

      {page.nextCursor && (
        <CategoryLoadMore
          href={`${routes.category(categorySlug)}?cursor=${encodeURIComponent(page.nextCursor)}`}
          label={t("loadMore")}
        />
      )}
    </div>
  );
}
