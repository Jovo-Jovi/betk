/**
 * Edit Listing (`/seller/listings/[id]/edit`) — Phase 05 / T04 (FR-SEL-9).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell). Dynamic/authed: prefills the same `ListingForm`
 * (mode="edit") from `getOwnListingById` (T02) — own-store scoped, ANY
 * status (draft/active/paused/sold_out/removed all load here; the Listings
 * Management "removed" tab still links Edit for non-removed rows only, but
 * this route itself doesn't re-derive that gate).
 *
 * HARD 404 (binding rule, carried from Phase 03/04): an unknown id, a
 * malformed (non-UUID) id, or another seller's listing id all resolve to the
 * SAME `notFound()` — no existence leak, same convention as the public
 * listing detail page. `listingIdSchema.safeParse` runs BEFORE the query
 * (the query itself `.parse()`s and would throw on a malformed id — the
 * public listing-detail page's `resolveListing` precedent). NO `loading.tsx`
 * exists at this segment or any ancestor — a route-level Suspense boundary
 * would stream a 200 shell before this `notFound()` can commit its real
 * status code (the exact BL-01-FIX / Phase-04-T04 class of bug).
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnListingById } from "@/features/listings";
import { getCategoryTree } from "@/features/discovery";
import { listingIdSchema } from "@/validations/discovery";
import { routes } from "@/constants/routes";
import { StatusBadge } from "@/components/shared";
import { ListingForm } from "../../_components/ListingForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.listings.form");
  return { title: `${t("editMetaTitle")} — BETK` };
}

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? "media";

interface RouteParams {
  id: string;
}

export default async function EditListingPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params;
  const t = await getTranslations("seller.listings.form");
  const tCommon = await getTranslations("seller.listings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const idResult = listingIdSchema.safeParse(id);
  const [listing, categories] = await Promise.all([
    idResult.success ? getOwnListingById(idResult.data, supabase) : Promise.resolve(null),
    getCategoryTree(supabase),
  ]);

  if (!listing) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-lg font-bold text-foreground">{t("editTitle")}</h1>
        <StatusBadge domain="listing" status={listing.status} label={tCommon(`filter.${listing.status}`)} />
      </div>

      <ListingForm mode="edit" uid={user.id} mediaBucket={MEDIA_BUCKET} categories={categories} initial={listing} />
    </div>
  );
}
