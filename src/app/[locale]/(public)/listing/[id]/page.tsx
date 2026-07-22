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
 * querying), a missing id, a soft-deleted listing (R-L10), a hidden-status
 * listing (draft/paused/removed — NOT in the `listings_public` set), AND a
 * suspended store's listing (T04 STEP 0 — the query's own
 * `if (!store) return null` guard, re-verified by this task's own integration
 * test). All of these hard-404 identically — no existence leak, same
 * convention as `getCategoryBySlug`/`getStoreBySlug`.
 *
 * ── REG-25 (RESOLVED, migration 20260718230302) ── `listings_public` now
 * exposes `status IN ('active','sold_out')`, so a genuinely `sold_out`
 * listing (reached via R2's `decrement_stock_on_confirm` trigger at
 * `stock_qty=0`) STAYS publicly visible here with the R-N06 restock CTA
 * (FR-PUB-4). The catalog child policies `listing_images_public` /
 * `listing_tags_public` were amended verbatim-consistent, so the gallery and
 * tag chips render for a sold_out detail page too. The sold-out UI below fires
 * off `isListingSoldOut` (status enum authoritative, `stock_qty<=0` the
 * coupled path) — see `listingStockDisplay.ts`. sold_out is DETAIL-ONLY:
 * browse grids (homepage/search/category/storefront) keep `status='active'`
 * per BETK_UI_SPEC.md L73/85/97/121.
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
 * with the rest of the discovery read layer; `revalidate = 60` keeps this
 * ISR-cacheable per id. IDENTITY-FREE by design (Phase-03 T06 decision): the
 * detail page deliberately does NOT hydrate per-user wishlist state — the
 * action buttons route a guest/authed click to /auth/login — so there is no
 * `cookies()` dependency to force dynamic.
 *
 * PERF-02: this route is ISR (`revalidate = 60`). Locale is threaded
 * EXPLICITLY from the validated `[locale]` segment param — every
 * `getTranslations({locale})` here (and in generateMetadata) is passed the
 * locale rather than reading it from next-intl's request store. That store
 * (`setRequestLocale`) is only guaranteed inside pages/layouts, and during
 * runtime on-demand ISR generation of a NON-default locale it is not resolved,
 * so a store-based `getTranslations()`/`getLocale()` would fall back to
 * `headers()` and abort generation with DYNAMIC_SERVER_USAGE (the default
 * locale is silently masked by next-intl's fallback). `setRequestLocale(locale)`
 * is still called to prime the client provider, but the render path does not
 * depend on it. The streamed `MoreFromStoreRail` already takes `locale` as a
 * prop and calls no next-intl server API. Under ISR an unknown/invalid id stays
 * a hard 404 on first AND repeat hits (the 404 verdict is cached per path).
 *
 * CD-DELTA-2 (T06): `ImageGallery` is now consumed DIRECTLY from
 * `@/components/shared` — the T05 `ListingImageGallery` client wrapper (which
 * re-established the client boundary the shared component was missing) is
 * DELETED now that `ImageGallery.tsx` carries its own `"use client"`
 * directive at the source.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
  ImageGallery,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { ListingActionButtons } from "@/features/discovery/components/ListingActionButtons";
import { MoreFromStoreRail } from "@/features/discovery/components/MoreFromStoreRail";
import { deriveStockDisplayProps, isListingSoldOut } from "@/features/discovery/listingStockDisplay";

export const revalidate = 60;

/**
 * PERF-02: enable ISR for this dynamic segment. We prerender NO specific ids at
 * build (ids are unbounded + runtime-created); with the default
 * `dynamicParams = true`, each `/listing/<id>` is generated on its first hit and
 * then cached per `revalidate` (60s). Without a `generateStaticParams` export, a
 * dynamic segment renders per-request (`ƒ`) even with `revalidate` set — the
 * PERF-01 build proved the page was `ƒ` despite the `revalidate = 60` above.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

interface RouteParams {
  locale: string;
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
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "listing" });

  const listing = await resolveListing(id).catch(() => null);
  if (!listing) {
    return { title: t("metaTitleFallback") };
  }

  const title = localizedName(
    { ar: listing.titleAr, en: listing.titleEn },
    locale as AppLocale,
  );
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
  const { locale: localeParam, id } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;
  const t = await getTranslations({ locale, namespace: "listing" });
  const catalogT = await getTranslations({ locale, namespace: "catalog" });

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
  const wishlistLabels = { addLabel: t("wishlist.add"), removeLabel: t("wishlist.remove") };
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
              <ImageGallery images={listing.images.map((img) => img.url)} alt={title} />

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
            storeId={listing.storeId}
            shareText={t("shareText", { title })}
            isSoldOut={soldOut}
            wishlistAddLabel={wishlistLabels.addLabel}
            wishlistRemoveLabel={wishlistLabels.removeLabel}
            inquiryLabel={t("cta.inquiry")}
            inquiryOwnListingReason={t("cta.inquiryOwnListingReason")}
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
          wishlistAddLabel={wishlistLabels.addLabel}
          wishlistRemoveLabel={wishlistLabels.removeLabel}
        />
      </Suspense>
    </div>
  );
}
