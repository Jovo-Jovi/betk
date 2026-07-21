/**
 * StoreListingsSection — the Listings tab content for `/store/[slug]`.
 * PERF-01 (streaming). Fetches `getActiveListings` scoped to this store (T01)
 * and renders the grid/empty/error states. The page wraps this in a
 * `<Suspense>` boundary (`SkeletonGrid` fallback, homepage
 * CategoriesSection/HomeStripsSection + the `/category/[slug]`
 * CategoryListingsSection precedent) so the storefront header/cover/avatar +
 * Reviews/About tabs (already resolved from the same `getStoreBySlug` read)
 * paint without waiting on this extra query.
 *
 * The store existence check (`getStoreBySlug` + `notFound()`) — and the
 * page's own follow-state read — stay at the page's top level, OUTSIDE this
 * boundary (hard-404 binding rule, BL-01-FIX/T04); this section only ever
 * renders once that decision has already committed. `StorefrontTabs` (client)
 * keeps ALL panels mounted (inactive ones `hidden`), so this Suspense
 * boundary streams into the initial HTML the same way the page's other
 * content does — it does not defer to a client refetch.
 */

import { getTranslations } from "next-intl/server";
import { getActiveListings } from "@/features/discovery";
import type { ListingPage } from "@/features/discovery";
import { createClient } from "@/lib/supabase/server";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { catalogListingBoostLabel } from "@/i18n/catalogLabels";
import { ListingCardLink } from "./ListingCardLink";
import { LoadMoreLink } from "./LoadMoreLink";

export async function StoreListingsSection({
  storeId,
  storeSlug,
  storeName,
  ratingAverage,
  ratingTotal,
  locale,
  cursor,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  ratingAverage: number | null;
  ratingTotal: number | null;
  locale: AppLocale;
  cursor: string | undefined;
}) {
  const t = await getTranslations("store");
  const catalogT = await getTranslations("catalog");
  const tListing = await getTranslations("listing");

  const boostLabel = catalogListingBoostLabel(catalogT);
  const wishlistLabels = { addLabel: tListing("wishlist.add"), removeLabel: tListing("wishlist.remove") };

  const supabase = await createClient();
  let page: ListingPage = { items: [], nextCursor: null };
  let isError = false;
  try {
    page = await getActiveListings({ store: storeId, cursor }, supabase);
  } catch {
    isError = true;
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t("error")}</p>;
  }

  if (page.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("listingsEmpty")}</p>;
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
            storeName={storeName}
            rating={ratingAverage}
            reviews={ratingTotal}
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
        <LoadMoreLink
          href={`${routes.store(storeSlug)}?tab=listings&cursor=${encodeURIComponent(page.nextCursor)}`}
          label={t("loadMore")}
        />
      )}
    </div>
  );
}
