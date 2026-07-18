/**
 * Category Browse (`/category/[slug]`, `/en/category/[slug]`) — PUBLIC route.
 * Phase 03 / T04 (FR-PUB-3). Wrapped by PublicShell (AppChrome + Footer) via
 * `(public)/layout.tsx` — chrome is NOT touched here.
 *
 * RSC: resolves the category by slug (`getCategoryBySlug`, T04) — is_active
 * =false OR unknown slug both resolve to `null` → hard `notFound()` (no
 * existence leak, same convention as `getStoreBySlug`'s R-S07 handling).
 * Then fetches the listing grid (`getActiveListings`, T01 + T04's category
 * OR-match + R-S07 `stores!inner` fix — see that file's header) via a
 * `?cursor=` URL param for forward pagination (see `CategoryLoadMore`).
 *
 * Reads go through the stateless anon client (no `cookies()`), same as the
 * rest of the discovery read layer — no ISR here (the page depends on
 * `searchParams.cursor`, so it's dynamic by nature, same rationale as
 * `/search`).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getActiveListings, getCategoryBySlug } from "@/features/discovery";
import type { ListingPage } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { Link } from "@/i18n/navigation";
import { catalogListingBoostLabel } from "@/i18n/catalogLabels";
import { EmptyState } from "@/components/shared";
import { SubcategoryChips } from "@/features/discovery/components/SubcategoryChips";
import { ListingCardLink } from "@/features/discovery/components/ListingCardLink";
import { StripErrorCard } from "@/features/discovery/components/StripErrorCard";
import { CategoryLoadMore } from "@/features/discovery/components/CategoryLoadMore";

interface RouteParams {
  slug: string;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("category");

  const category = await getCategoryBySlug(slug, createAnonClient());
  if (!category) {
    return { title: t("metaTitleFallback") };
  }

  const name = localizedName({ ar: category.nameAr, en: category.nameEn }, locale);
  return {
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("category");
  const tCommon = await getTranslations("common");
  const catalogT = await getTranslations("catalog");

  const supabase = createAnonClient();

  const category = await getCategoryBySlug(slug, supabase);
  if (!category) {
    // is_active=false OR unknown slug — both 404 (no existence leak).
    notFound();
  }

  const name = localizedName({ ar: category.nameAr, en: category.nameEn }, locale);
  const boostLabel = catalogListingBoostLabel(catalogT);
  const cursor = first(sp.cursor);

  let page: ListingPage = { items: [], nextCursor: null };
  let isError = false;
  try {
    page = await getActiveListings({ category: category.id, cursor }, supabase);
  } catch {
    isError = true;
  }

  const subcategoryItems = category.children.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: localizedName({ ar: c.nameAr, en: c.nameEn }, locale),
  }));

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h2 font-bold text-foreground">{name}</h1>
      </div>

      <SubcategoryChips items={subcategoryItems} />

      {isError ? (
        <StripErrorCard message={t("error")} retryLabel={tCommon("retry")} />
      ) : page.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card py-4">
          <EmptyState variant="default" message={t("empty.message", { name })} />
          <div className="flex flex-wrap items-center justify-center gap-4 pb-4">
            {category.parent && (
              <Link
                href={routes.category(category.parent.slug)}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t("empty.backToParent", {
                  name: localizedName(
                    { ar: category.parent.nameAr, en: category.parent.nameEn },
                    locale,
                  ),
                })}
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
      ) : (
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
                stockQty={listing.stockQty}
                isMadeToOrder={listing.isMadeToOrder}
                isService={listing.type === "service"}
              />
            ))}
          </div>

          {page.nextCursor && (
            <CategoryLoadMore
              href={`${routes.category(slug)}?cursor=${encodeURIComponent(page.nextCursor)}`}
              label={t("loadMore")}
            />
          )}
        </div>
      )}
    </div>
  );
}
