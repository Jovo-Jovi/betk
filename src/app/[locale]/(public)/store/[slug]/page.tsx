/**
 * Public Storefront (`/store/[slug]`, `/en/store/[slug]`) — PUBLIC route.
 * Phase 03 / T06 (FR-PUB-5). Wrapped by PublicShell (AppChrome + Footer) via
 * `(public)/layout.tsx` — chrome is NOT touched here.
 *
 * BINDING RULE (T04/T05 finding, carried forward): NO `loading.tsx` at any
 * segment wrapping this route — a route-level Suspense boundary would stream a
 * 200 shell before the deeper `notFound()` can commit its real 404 status
 * (the exact BL-01-FIX/T04 bug, fixed by DELETING the offending loading.tsx,
 * never by adding one). The `notFound()` decision below runs synchronously in
 * this page function with no Suspense boundary between the route and it.
 *
 * `getStoreBySlug(slug)` resolves to `null` for BOTH an unknown slug AND a
 * suspended/pending store — `stores_public` RLS (`status='active'`) makes RLS
 * denial and "no row" indistinguishable by design (R-S07, no existence leak),
 * so both hard-404 identically, both locales, by status code.
 *
 * IDENTITY-DEPENDENT (dynamic, NOT ISR): unlike the ISR-cached listing detail
 * page, this route reads the caller's own follow state (`getStoreFollowState`)
 * under the cookie client so the FollowButton renders REAL state for an
 * authenticated buyer. That per-user read makes the page dynamic by nature
 * (same client for the store, listings, and follow-state reads — one auth
 * context, one round of cookies()).
 *
 * REG-14 (delivery shape): `StoreDeliveryOptions.modes` vs the store-side
 * delivery enum is owned by Phase 04/07 — the About tab renders delivery modes
 * DEFENSIVELY (known modes → localized labels, unknown modes degrade to their
 * raw string, never throw); it does NOT "fix" the JSONB shape here.
 *
 * PERF-01: the Listings tab's own query (`getActiveListings` scoped to this
 * store) is streamed via `StoreListingsSection` wrapped in `<Suspense>`
 * (`SkeletonGrid` fallback) — same pattern as `/category/[slug]`'s
 * `CategoryListingsSection`. Reviews/About render from data already resolved
 * by the top-level `getStoreBySlug` read, so only the Listings tab benefits;
 * the hard-404 `notFound()` decision above stays untouched, outside Suspense.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getStoreBySlug, getStoreFollowState } from "@/features/discovery";
import type { StoreDetail } from "@/features/discovery";
import { createClient } from "@/lib/supabase/server";
import { localizedName } from "@/i18n/localizedName";
import type { AppLocale } from "@/i18n/routing";
import { GOVERNORATES } from "@/constants/governorates";
import {
  catalogRatingReviewsLabel,
  catalogSellerResponseLabel,
  catalogFollowButtonLabels,
  catalogVerifiedLabel,
  catalogLevelLabels,
  type CatalogTranslator,
} from "@/i18n/catalogLabels";
import { RatingSummary, StarRating, VerifiedBadge, LevelBadge, SkeletonGrid } from "@/components/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StoreFollowButton } from "@/features/discovery/components/StoreFollowButton";
import { StorefrontTabs } from "@/features/discovery/components/StorefrontTabs";
import { StoreListingsSection } from "@/features/discovery/components/StoreListingsSection";

interface RouteParams {
  slug: string;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

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
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("store");

  const store = await getStoreBySlug(slug).catch(() => null);
  if (!store) {
    return { title: t("metaTitleFallback") };
  }

  const name = localizedName({ ar: store.nameAr, en: store.nameEn }, locale);
  return {
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
  };
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("store");
  const catalogT = await getTranslations("catalog");

  const supabase = await createClient();

  const store: StoreDetail | null = await getStoreBySlug(slug, supabase);
  if (!store) {
    // Unknown slug OR suspended store — both hard-404 (R-S07, no existence leak).
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const following = await getStoreFollowState(store.id, user?.id ?? null, supabase);

  const name = localizedName({ ar: store.nameAr, en: store.nameEn }, locale);
  const followLabels = catalogFollowButtonLabels(catalogT);
  const levelLabels = catalogLevelLabels(catalogT);

  const avgResponseHours = store.seller?.avgResponseHours ?? undefined;
  const responseLabel =
    typeof avgResponseHours === "number"
      ? catalogSellerResponseLabel(catalogT, avgResponseHours)
      : undefined;

  const locationLabel =
    governorateLabel(store.governorate, locale) + (store.city ? ` · ${store.city}` : "");

  // ── Listings tab (cursor-paginated over this store's active listings) ───────
  // PERF-01: streamed via StoreListingsSection (Suspense), not fetched here.
  const cursor = first(sp.cursor);
  const defaultTab = first(sp.tab);

  const distribution = store.rating?.distribution ?? undefined;

  const listingsContent = (
    <Suspense fallback={<SkeletonGrid />}>
      <StoreListingsSection
        storeId={store.id}
        storeSlug={store.slug}
        storeName={name}
        ratingAverage={store.rating?.averageRating ?? null}
        ratingTotal={store.rating?.totalReviews ?? null}
        locale={locale}
        cursor={cursor}
      />
    </Suspense>
  );

  // ── Reviews tab (visible reviews, photos + seller replies) ──────────────────
  const reviewsContent =
    store.reviews.length === 0 ? (
      <p className="text-sm text-muted-foreground">{t("reviews.empty")}</p>
    ) : (
      <div className="flex flex-col gap-4">
        {store.reviews.map((review) => (
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
                  <img key={photo.url} src={photo.url} alt="" className="size-16 rounded-md object-cover" />
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
    );

  // ── About tab (payment_methods + delivery_options — REG-14 defensive) ───────
  const aboutContent = (
    <div className="grid gap-6 sm:grid-cols-2">
      <StorePaymentSection store={store} t={t} />
      <StoreDeliverySection store={store} t={t} locale={locale} />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6">
      {/* Cover + avatar */}
      <div className="flex flex-col gap-4">
        <div className="relative h-36 w-full overflow-hidden rounded-lg bg-muted sm:h-48">
          {store.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute -bottom-8 start-4">
            <Avatar className="size-20 border-4 border-background">
              {store.avatarUrl && <AvatarImage src={store.avatarUrl} alt={name} />}
              <AvatarFallback className="text-lg font-bold">{name.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-h2 font-bold text-foreground">{name}</h1>
                {store.seller?.isVerified && <VerifiedBadge label={catalogVerifiedLabel(catalogT)} showLabel={false} />}
                {store.seller && <LevelBadge level={store.seller.level} labels={levelLabels} />}
              </div>
              <p className="text-sm text-muted-foreground">{locationLabel}</p>
              {responseLabel && <p className="text-xs text-muted-foreground">{responseLabel}</p>}
            </div>
            <StoreFollowButton
              storeId={store.id}
              storeSlug={store.slug}
              initialFollowing={following}
              followLabel={followLabels.followLabel}
              followingLabel={followLabels.followingLabel}
            />
          </div>

          {store.bioAr && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{store.bioAr}</p>
          )}

          <RatingSummary
            average={store.rating?.averageRating ?? 0}
            total={store.rating?.totalReviews ?? 0}
            distribution={distribution}
            compact
            reviewsLabel={catalogRatingReviewsLabel(catalogT, store.rating?.totalReviews ?? 0)}
          />

          {/* Return-policy accordion (native disclosure — no shadcn Accordion in ui) */}
          <details className="rounded-lg border border-border bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              {t("returnPolicy.title")}
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {store.returnPolicy ?? t("returnPolicy.empty")}
            </p>
          </details>
        </div>
      </div>

      <StorefrontTabs
        defaultTabId={defaultTab}
        tabs={[
          { id: "listings", label: t("tabs.listings"), content: listingsContent },
          { id: "reviews", label: t("tabs.reviews"), content: reviewsContent },
          { id: "about", label: t("tabs.about"), content: aboutContent },
        ]}
      />
    </div>
  );
}

/** About → payment methods. Renders only the handles/flags the seller set. */
function StorePaymentSection({
  store,
  t,
}: {
  store: StoreDetail;
  t: CatalogTranslator;
}) {
  const pm = store.paymentMethods;
  const rows: { label: string; value?: string }[] = [];
  if (pm.instapay_handle) rows.push({ label: t("about.payment.instapay"), value: pm.instapay_handle });
  if (pm.vodafone_cash) rows.push({ label: t("about.payment.vodafoneCash"), value: pm.vodafone_cash });
  if (pm.orange_cash) rows.push({ label: t("about.payment.orangeCash"), value: pm.orange_cash });
  if (pm.cod_enabled) rows.push({ label: t("about.payment.cod") });

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-h3 text-foreground">{t("about.paymentTitle")}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("about.paymentEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{row.label}</span>
              {row.value && (
                <span className="font-mono text-muted-foreground" dir="ltr">
                  {row.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * About → delivery options. REG-14: `modes` is rendered defensively — known
 * modes map to localized labels, unknown modes degrade to their raw string
 * (never throw, never "fix" the shape). The numeric/flag fields render only
 * when present.
 */
function StoreDeliverySection({
  store,
  t,
  locale,
}: {
  store: StoreDetail;
  t: CatalogTranslator;
  locale: AppLocale;
}) {
  const d = store.deliveryOptions;
  const modeLabels = t.raw("about.delivery.modes") as Record<string, string>;
  const modes = Array.isArray(d.modes) ? d.modes : [];

  const lines: string[] = [];
  if (typeof d.min_delivery_days === "number" && typeof d.max_delivery_days === "number") {
    lines.push(t("about.delivery.deliveryDays", { min: d.min_delivery_days, max: d.max_delivery_days }));
  }
  if (typeof d.delivery_fee_egp === "number") {
    lines.push(t("about.delivery.deliveryFee", { fee: d.delivery_fee_egp }));
  }
  if (typeof d.free_delivery_threshold_egp === "number") {
    lines.push(t("about.delivery.freeThreshold", { amount: d.free_delivery_threshold_egp }));
  }
  if (d.pickup_governorate) {
    lines.push(t("about.delivery.pickupGovernorate", { governorate: governorateLabel(d.pickup_governorate, locale) }));
  }
  if (d.ships_nationwide === true) {
    lines.push(t("about.delivery.shipsNationwide"));
  }

  const isEmpty = modes.length === 0 && lines.length === 0;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-h3 text-foreground">{t("about.deliveryTitle")}</h2>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{t("about.deliveryEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {modes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {modes.map((mode) => (
                <span
                  key={mode}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground"
                >
                  {modeLabels[mode] ?? mode}
                </span>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
