/**
 * HomeStripsSection — live collections + New Arrivals + Featured/Boosted.
 * Phase 03 / T02.
 *
 * Server Component: single `getHomepageData()` (T01) call via the stateless
 * anon client (no `cookies()` — keeps the route revalidate-able, 60s TTL per
 * ARCHITECTURE). T01 already resolves the three strips independently
 * (`Promise.all`, each strip catches its own error) — this component reads
 * each strip's own `status`/`data` and renders accordingly, so one failed
 * strip never blocks the others (Phase 03 invariant).
 *
 * NOTE on "progressive render as each strip resolves" (UI Spec §Homepage):
 * T01's `getHomepageData()` awaits all three strips in parallel and returns
 * one settled object, so from this component's perspective they resolve
 * together, gated by the slowest. True per-strip HTTP streaming would need
 * T01's three internal fetchers exported individually — out of scope for a
 * composition-only task; the page still streams progressively RELATIVE to
 * the Hero and the Categories section (separate Suspense boundaries).
 *
 * Empty-state rule (UI Spec): "zero active listings platform-wide" is
 * derived from `newArrivals` alone — it is the unfiltered active/!deleted
 * set (T01), so if it legitimately resolves to zero, boosted/collections
 * listings must also be empty (both are subsets of active listings). Only
 * shown when newArrivals resolved OK-empty (not on a newArrivals fetch
 * error, where we can't safely conclude "platform-wide empty").
 */

import { getTranslations, getLocale } from "next-intl/server";
import { getHomepageData } from "@/features/discovery";
import type { HomepageCollection, ListingSummary } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import { catalogCollectionDir, catalogListingBoostLabel } from "@/i18n/catalogLabels";
import type { AppLocale } from "@/i18n/routing";
import { CollectionStrip } from "@/components/shared";
import { ListingCardLink } from "./ListingCardLink";
import { StripErrorCard } from "./StripErrorCard";
import { EmptyGettingStarted } from "./EmptyGettingStarted";

interface WishlistLabels {
  addLabel: string;
  removeLabel: string;
}

function toCardProps(
  listing: ListingSummary,
  locale: AppLocale,
  boostLabel: string,
  wishlistLabels: WishlistLabels,
  boosted?: boolean,
) {
  return {
    id: listing.id,
    title: localizedName({ ar: listing.titleAr, en: listing.titleEn }, locale),
    image: listing.heroImageUrl,
    price: listing.price,
    priceType: listing.priceType,
    storeName: listing.store ? localizedName({ ar: listing.store.nameAr, en: listing.store.nameEn }, locale) : null,
    rating: listing.store?.rating?.averageRating ?? null,
    reviews: listing.store?.rating?.totalReviews ?? null,
    boosted,
    boostLabel,
    wishlistAddLabel: wishlistLabels.addLabel,
    wishlistRemoveLabel: wishlistLabels.removeLabel,
    stockQty: listing.stockQty,
    isMadeToOrder: listing.isMadeToOrder,
    isService: listing.type === "service",
  };
}

function ListingGrid({
  listings,
  locale,
  boostLabel,
  wishlistLabels,
  boosted,
}: {
  listings: ListingSummary[];
  locale: AppLocale;
  boostLabel: string;
  wishlistLabels: WishlistLabels;
  boosted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {listings.map((listing) => (
        <ListingCardLink key={listing.id} {...toCardProps(listing, locale, boostLabel, wishlistLabels, boosted)} />
      ))}
    </div>
  );
}

function CollectionsStrips({
  collections,
  locale,
  boostLabel,
  wishlistLabels,
}: {
  collections: HomepageCollection[];
  locale: AppLocale;
  boostLabel: string;
  wishlistLabels: WishlistLabels;
}) {
  const dir = catalogCollectionDir(locale);
  return (
    <>
      {collections
        .filter((collection) => collection.listings.length > 0)
        .map((collection) => (
          <CollectionStrip
            key={collection.id}
            titleAr={localizedName({ ar: collection.nameAr, en: collection.nameEn }, locale)}
            dir={dir}
            itemWidth={200}
          >
            {collection.listings.map((listing) => (
              <ListingCardLink key={listing.id} {...toCardProps(listing, locale, boostLabel, wishlistLabels)} />
            ))}
          </CollectionStrip>
        ))}
    </>
  );
}

export async function HomeStripsSection() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const catalogT = await getTranslations("catalog");
  const tListing = await getTranslations("listing");
  const locale = (await getLocale()) as AppLocale;
  const boostLabel = catalogListingBoostLabel(catalogT);
  const wishlistLabels = { addLabel: tListing("wishlist.add"), removeLabel: tListing("wishlist.remove") };

  const data = await getHomepageData(createAnonClient());

  // "Zero active listings platform-wide" — see file header note.
  const platformEmpty = data.newArrivals.status === "ok" && (data.newArrivals.data?.length ?? 0) === 0;
  if (platformEmpty) {
    return (
      <EmptyGettingStarted
        title={t("empty.gettingStartedTitle")}
        message={t("empty.gettingStartedMessage")}
        ctaLabel={t("empty.becomeSeller")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {data.collections.status === "error" && (
        <StripErrorCard message={t("error.message")} retryLabel={tCommon("retry")} compact />
      )}
      {data.collections.status === "ok" && (
        <CollectionsStrips collections={data.collections.data ?? []} locale={locale} boostLabel={boostLabel} wishlistLabels={wishlistLabels} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 text-foreground">{t("newArrivals.title")}</h2>
        {data.newArrivals.status === "error" && (
          <StripErrorCard message={t("error.message")} retryLabel={tCommon("retry")} compact />
        )}
        {data.newArrivals.status === "ok" && (
          <ListingGrid listings={data.newArrivals.data ?? []} locale={locale} boostLabel={boostLabel} wishlistLabels={wishlistLabels} />
        )}
      </section>

      {data.boosted.status === "error" && (
        <StripErrorCard message={t("error.message")} retryLabel={tCommon("retry")} compact />
      )}
      {data.boosted.status === "ok" && (data.boosted.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2 text-foreground">{t("boosted.title")}</h2>
          <ListingGrid listings={data.boosted.data ?? []} locale={locale} boostLabel={boostLabel} wishlistLabels={wishlistLabels} boosted />
        </section>
      )}
    </div>
  );
}
