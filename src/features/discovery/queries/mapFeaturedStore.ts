/**
 * Row → StoreCard props for the homepage stores row.
 * Pure: no client, so unit tests import this file alone.
 *
 * Helpers reused:
 *   localizedName — src/i18n/localizedName.ts
 *   withLocale + routes.store — src/constants/routes.ts
 *   GOVERNORATES label — same lookup as the listing page's governorateLabel
 *     (src/app/[locale]/(public)/listing/[id]/page.tsx)
 *   avatar/cover — stored public URL, omitted when null (listing page passes
 *     `avatarUrl ?? undefined`)
 */

import type { SellerLevel } from "@/constants/enums";
import { GOVERNORATES } from "@/constants/governorates";
import { routes, withLocale } from "@/constants/routes";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import type { FeaturedStore } from "../types";
import { asSingle } from "./_shared";

export interface RawFeaturedStoreRating {
  average_rating: number | string;
  total_reviews: number | string;
}

export interface RawFeaturedStoreSeller {
  level: SellerLevel;
  is_verified: boolean;
}

export interface RawFeaturedStoreRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  governorate: string;
  created_at: string;
  rating_aggregates: RawFeaturedStoreRating | RawFeaturedStoreRating[] | null;
  seller_profiles: RawFeaturedStoreSeller | RawFeaturedStoreSeller[] | null;
}

function governorateLabel(value: string, locale: AppLocale): string {
  const found = GOVERNORATES.find((g) => g.value === value);
  if (!found) return value;
  return locale === "en" ? found.labelEn : found.labelAr;
}

function finiteNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function publicUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value;
}

export function mapFeaturedStore(row: RawFeaturedStoreRow, locale: AppLocale): FeaturedStore {
  const rating = asSingle(row.rating_aggregates);
  const seller = asSingle(row.seller_profiles);
  const average = finiteNumber(rating?.average_rating);
  const reviews = finiteNumber(rating?.total_reviews);

  return {
    id: row.id,
    name: localizedName({ ar: row.name_ar, en: row.name_en }, locale),
    storeHref: withLocale(routes.store(row.slug), locale),
    avatar: publicUrl(row.avatar_url),
    cover: publicUrl(row.cover_url),
    level: seller?.level,
    verified: seller?.is_verified ?? false,
    rating: average,
    reviews: reviews,
    governorate: governorateLabel(row.governorate, locale),
    hideFollow: true,
  };
}
