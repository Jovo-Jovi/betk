/**
 * Listings Management (`/seller/listings`) — Phase 05 / T03 (FR-SEL-8).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell via `SellerChrome`). Dynamic/authed: reads the
 * caller's OWN listings (any status) via the T02 `getOwnListings` +
 * `getOwnListingsStatusCounts` queries under the cookie client — RLS
 * `listings_seller` + a server-verified own-store pin (T02 `_shared`).
 * Middleware already gates every `/seller*` route; this page does not
 * re-implement it.
 *
 * Status filter + page number are read from `searchParams` (search-page /
 * PERF-01-era precedent: `safeParse` with a schema-default fallback so a
 * tampered/stale shareable URL degrades gracefully, never a 500). This
 * route is dynamic by nature (own-store, per-user data) — no ISR.
 *
 * BOOST row action is intentionally OMITTED — boosts are Phase 11
 * (FR-SEL-11/12); no dead route is wired here (Phase-04 `/seller` landing
 * precedent for "defer, don't invent").
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnListings, getOwnListingsStatusCounts } from "@/features/listings";
import { getOwnListingsParamsSchema } from "@/validations/listings";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { ListingsFilterTabs } from "./_components/ListingsFilterTabs";
import { ListingsList } from "./_components/ListingsList";
import { ListingsPagination } from "./_components/ListingsPagination";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.listings");
  return { title: `${t("metaTitle")} — BETK` };
}

type RawSearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

interface Props {
  searchParams: Promise<RawSearchParams>;
}

export default async function SellerListingsPage({ searchParams }: Props) {
  const t = await getTranslations("seller.listings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const sp = await searchParams;
  const rawPage = first(sp.page);
  const parsedResult = getOwnListingsParamsSchema.safeParse({
    status: first(sp.status),
    page: rawPage ? Number(rawPage) : undefined,
  });
  const parsed = parsedResult.success ? parsedResult.data : getOwnListingsParamsSchema.parse({});

  const [listingsPage, counts] = await Promise.all([
    getOwnListings(parsed, supabase),
    getOwnListingsStatusCounts(supabase),
  ]);

  const totalPages = Math.max(1, Math.ceil(listingsPage.total / listingsPage.pageSize));
  const isEmpty = listingsPage.items.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-foreground">{t("title")}</h1>
        <Button asChild size="sm">
          <Link href={routes.seller.listingNew}>{t("newCta")}</Link>
        </Button>
      </div>

      <ListingsFilterTabs currentStatus={parsed.status} counts={counts} />

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            variant={parsed.status === "all" ? "default" : "filtered"}
            message={parsed.status === "all" ? t("empty.message") : t("empty.filteredMessage")}
            hint={parsed.status === "all" ? t("empty.hint") : undefined}
          />
          {parsed.status === "all" && (
            <Button asChild size="sm">
              <Link href={routes.seller.listingNew}>{t("empty.cta")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <ListingsList items={listingsPage.items} />
          <ListingsPagination status={parsed.status} page={listingsPage.page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
