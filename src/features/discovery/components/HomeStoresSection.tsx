/**
 * HomeStoresSection — featured stores row on the homepage (D2, REG-111).
 *
 * Server Component. One `getFeaturedStores()` call via the stateless anon
 * client (no `cookies()`), same as HomeStripsSection, so `revalidate = 60`
 * on the page still caches this read.
 *
 * Strip layout follows `src/components/shared/CollectionStrip.tsx` (the
 * titled horizontal row the homepage already uses for collections).
 * Empty result renders nothing, including the heading. hideFollow is set
 * on every card; listingCount is not passed.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { CollectionStrip, StoreCard } from "@/components/shared";
import { getFeaturedStores } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { catalogCollectionDir, catalogLevelLabels, catalogVerifiedLabel } from "@/i18n/catalogLabels";
import type { AppLocale } from "@/i18n/routing";

export async function HomeStoresSection() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("home");
  const catalogT = await getTranslations("catalog");
  const stores = await getFeaturedStores(locale, createAnonClient());

  if (stores.length === 0) return null;

  const levelLabels = catalogLevelLabels(catalogT);
  const verifiedLabel = catalogVerifiedLabel(catalogT);

  return (
    <div id="stores" className="scroll-mt-[var(--topbar-height)]">
      <CollectionStrip titleAr={t("stores.title")} dir={catalogCollectionDir(locale)} itemWidth={240}>
        {stores.map((store) => (
          <StoreCard
            key={store.id}
            name={store.name}
            storeHref={store.storeHref}
            avatar={store.avatar}
            cover={store.cover}
            level={store.level}
            verified={store.verified}
            rating={store.rating}
            reviews={store.reviews}
            governorate={store.governorate}
            verifiedLabel={verifiedLabel}
            levelLabels={levelLabels}
            hideFollow={store.hideFollow}
          />
        ))}
      </CollectionStrip>
    </div>
  );
}
