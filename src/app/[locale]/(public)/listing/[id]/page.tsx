/**
 * Listing Detail (`/listing/[id]`, `/en/listing/[id]`) — PUBLIC route.
 * Phase 03 / T05 (FR-PUB-4). Wrapped by PublicShell via `(public)/layout.tsx`
 * — chrome is NOT touched here.
 *
 * BINDING RULE (T04 finding, carried forward): NO `loading.tsx` at any
 * segment wrapping this route — a route-level Suspense boundary streams a
 * 200 shell before a deeper `notFound()` can commit its real status code
 * (the exact bug BL-01-FIX and T04 both hit and fixed by DELETING the
 * offending `loading.tsx`, never by adding another one). Loading here is
 * in-page `<Suspense>` ONLY, and only around content that can NEVER itself
 * decide `notFound()` — see `MoreFromStoreRail` below, the one async
 * fragment that isn't the primary `getListingById` fetch. The `notFound()`
 * decision below happens synchronously in this page function, with no
 * Suspense boundary between the route and it.
 *
 * `getListingById(id)` already resolves to `null` for: a malformed
 * (non-UUID) id (guarded here via `listingIdSchema.safeParse` before even
 * querying), a missing id, a soft-deleted listing (R-L10), a non-'active'
 * listing (draft/paused/removed — `listings_public` RLS), AND a suspended
 * store's listing (T04 STEP 0 — the query's own `if (!store) return null`
 * guard, re-verified by this task's own integration test). All of these
 * hard-404 identically — no existence leak, same convention as
 * `getCategoryBySlug`/`getStoreBySlug`.
 *
 * ── FINDING (live-verified, NOT fixed here — no new policy in this task's
 * scope) ── `listings_public` RLS's `status='active'` clause ALSO hides a
 * listing once its status enum flips to `sold_out` (R2's now-live
 * `decrement_stock_on_confirm` trigger does exactly this at `stock_qty=0`),
 * even though FR-PUB-4/R-N06 explicitly require a sold-out listing to STAY
 * publicly visible with a "notify me" CTA. See
 * `tests/integration/discovery.listing.test.ts` for the live reproduction
 * (recorded as a FINDING, not a FAIL — this page cannot fix an RLS policy).
 * Flagged in SESSION_CONTEXT/journal for a dedicated review task. This
 * page's OWN sold-out UI (below) still renders correctly for every listing
 * RLS actually lets it see — i.e. any listing whose `status` is still
 * 'active' but whose `stock_qty` reads 0, which today is the only
 * anon-visible path to a genuine sold-out STATE (the enum flip and the
 * stock decrement happen together, in the same trigger transaction) — see
 * `listingStockDisplay.ts`.
 *
 * `view_count` (FR-PUB-4) — CONFIRMED no increment mechanism exists: no
 * trigger/function in `BETK_DATABASE_SCHEMA.sql` touches `view_count`
 * (only `update_listing_search_vector` / `decrement_stock_on_confirm` /
 * `set_review_edit_deadline` / `set_dispute_sla` / `recalculate_rating_
 * aggregate` do), and anon has no UPDATE grant on `listings`
 * (`listings_public` is FOR SELECT only; `listings_seller`'s FOR ALL
 * requires `store_id = betk.my_store_id()`, never true for anon). Per the
 * task instruction, shipped WITHOUT incrementing — no new policy, no
 * service-role reach-around.
 *
 * Reads go through the stateless anon client (no `cookies()`), consistent
 * with the rest of the discovery read layer; `revalidate` keeps this
 * ISR-cacheable per id.
 *
 * FINDING (live-verified via runtime smoke, NOT fixed in `shared/*`) —
 * `ImageGallery` is rendered via `ListingImageGallery`
 * (`features/discovery/components/`), a thin `"use client"` wrapper: see
 * that file's header for the full writeup of the shared-kit gap it works
 * around (a missing `"use client"` directive on `ImageGallery.tsx` itself,
 * which crashed this — its first-ever real page — at request time).
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getListingById, listingIdSchema } from "@/features/discovery";
import type { ListingDetail } from "@/features/discovery";
import { createAnonClient } from "@/lib/supabase/anon";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { GOVERNORATES } from "@/constants/governorates";
import {
  catalogPriceLabels,
  catalogStockLabels,
  catalogStockRemainingLabel,
  catalogRatingReviewsLabel,
  catalogWishlistLabels,
  catalogSellerResponseLabel,
  catalogListingBoostLabel,
} from "@/i18n/catalogLabels";
import {
  PriceBlock,
  StockBadge,
  SellerMiniCard,
  RatingSummary,
  StarRating,
  SkeletonGrid,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { ListingActionButtons } from "@/features/discovery/components/ListingActionButtons";
import { ListingImageGallery } from "@/features/discovery/components/ListingImageGallery";
import { MoreFromStoreRail } from "@/features/discovery/components/MoreFromStoreRail";
import { deriveStockDisplayProps, isListingSoldOut } from "@/features/discovery/listingStockDisplay";

export const revalidate = 60;

interface RouteParams {
  id: string;
}

/** Malformed (non-UUID) ids resolve to `null` too — same 404 as "not found". */
async function resolveListing(id: string): Promise<ListingDetail | null> {
  const parsed = listingIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return getListingById(parsed.data, createAnonClient());
}

function governorateLabel(value: string, locale: AppLocale): string {
  const found = GOVERNORATES.find((g) => g.value === value);
  if (!found) return value;
  return locale === "en" ? found.labelEn : found.labelAr;
}

function formatReviewDate(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-EG" : "ar-EG", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("listing");

  const listing = await resolveListing(id).catch(() => null);
  if (!listing) {
    return { title: t("metaTitleFallback") };
  }

  const title = localizedName({ ar: listing.titleAr, en: listing.titleEn }, locale);
  return {
    title: t("metaTitle", { title }),
    description: t("metaDescription", { title }),
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("listing");
  const catalogT = await getTranslations("catalog");

  const listing = await resolveListing(id);
  if (!listing) {
    notFound();
  }

  const title = localizedName({ ar: listing.titleAr, en: listing.titleEn }, locale);
  const storeName = localizedName({ ar: listing.store.nameAr, en: listing.store.nameEn }, locale);

  const soldOut = isListingSoldOut(listing);
  const stockProps = deriveStockDisplayProps(listing);
  const priceLabels = catalogPriceLabels(catalogT);
  const stockLabels = catalogStockLabels(catalogT);
  const wishlistLabels = catalogWishlistLabels(catalogT);
  const boostLabel = catalogListingBoostLabel(catalogT);
  const remainingLabel =
    typeof stockProps.stockQty === "number" && stockProps.stockQty > 0
      ? catalogStockRemainingLabel(catalogT, stockProps.stockQty)
      : undefined;

  const avgResponseHours = listing.seller?.avgResponseHours ?? undefined;
  const responseLabel =
    typeof avgResponseHours === "number"
      ? catalogSellerResponseLabel(catalogT, avgResponseHours)
      : undefined;

  const distribution = listing.store.rating?.distribution ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-8 px-4 py-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_1fr]">
              <ListingImageGallery images={listing.images.map((img) => img.url)} alt={title} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-h2 font-bold text-foreground">{title}</h1>
            {listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {listing.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PriceBlock
              price={listing.price}
              priceType={listing.priceType}
              size="lg"
              currency={priceLabels.currency}
              startingFromLabel={priceLabels.startingFromLabel}
              perHourLabel={priceLabels.perHourLabel}
              quoteLabel={priceLabels.quoteLabel}
            />
            <StockBadge {...stockProps} labels={stockLabels} remainingLabel={remainingLabel} />
          </div>

          <ListingActionButtons
            listingId={listing.id}
            shareText={t("shareText", { title })}
            isSoldOut={soldOut}
            wishlistAddLabel={wishlistLabels.addLabel}
            wishlistRemoveLabel={wishlistLabels.removeLabel}
            inquiryLabel={t("cta.inquiry")}
            notifyMeLabel={t("cta.notifyMe")}
            shareLabel={t("cta.share")}
          />

          <SellerMiniCard
            name={storeName}
            avatar={listing.store.avatarUrl ?? undefined}
            level={listing.seller?.level}
            verified={listing.seller?.isVerified}
            rating={listing.store.rating?.averageRating}
            reviews={listing.store.rating?.totalReviews}
            responseHours={avgResponseHours}
            responseLabel={responseLabel}
            governorate={
              governorateLabel(listing.store.governorate, locale) +
              (listing.store.city ? ` · ${listing.store.city}` : "")
            }
          />
        </div>
      </div>

      {listing.descriptionAr && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-h2 text-foreground">{t("descriptionTitle")}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {listing.descriptionAr}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-h2 text-foreground">{t("reviews.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("reviews.subtitle")}</p>
        </div>

        <RatingSummary
          average={listing.store.rating?.averageRating ?? 0}
          total={listing.store.rating?.totalReviews ?? 0}
          distribution={distribution}
          reviewsLabel={catalogRatingReviewsLabel(catalogT, listing.store.rating?.totalReviews ?? 0)}
        />

        {listing.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reviews.empty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {listing.reviews.map((review) => (
              <div
                key={review.id}
                className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} size={14} />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t("reviews.buyerLabel")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {formatReviewDate(review.createdAt, locale)}
                  </span>
                </div>
                {review.body && <p className="text-sm text-foreground">{review.body}</p>}
                {review.photos.length > 0 && (
                  <div className="flex gap-2">
                    {review.photos.map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photo.url}
                        src={photo.url}
                        alt=""
                        className="size-16 rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}
                {review.sellerReply && (
                  <div className="rounded-md bg-muted p-2.5">
                    <p className="mb-1 text-xs font-semibold text-foreground">
                      {t("reviews.sellerReplyLabel")}
                    </p>
                    <p className="text-sm text-muted-foreground">{review.sellerReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Suspense fallback={<SkeletonGrid count={4} />}>
        <MoreFromStoreRail
          storeId={listing.storeId}
          excludeListingId={listing.id}
          locale={locale}
          title={t("moreFromStore")}
          boostLabel={boostLabel}
        />
      </Suspense>
    </div>
  );
}
