/**
 * Create Listing (`/seller/listings/new`) — Phase 05 / T04 (FR-SEL-9).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell). Dynamic/authed: middleware already gates every
 * `/seller*` route; this page only defensively re-checks the session before
 * handing bilingual category data + the media-bucket name down to the
 * client `ListingForm` (mode="create"). No images section here — see the
 * form's own header comment (a listing needs a persisted id first).
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/features/discovery";
import { routes } from "@/constants/routes";
import { ListingForm } from "../_components/ListingForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.listings.form");
  return { title: `${t("newMetaTitle")} — BETK` };
}

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? "media";

export default async function NewListingPage() {
  const t = await getTranslations("seller.listings.form");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const categories = await getCategoryTree(supabase);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("newTitle")}</h1>

      <ListingForm mode="create" uid={user.id} mediaBucket={MEDIA_BUCKET} categories={categories} />
    </div>
  );
}
