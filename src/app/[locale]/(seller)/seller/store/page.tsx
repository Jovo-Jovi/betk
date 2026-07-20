/**
 * Store Profile Settings (/seller/store) — Phase 04 / T06 (FR-SEL-4).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell). Dynamic/authed: reads the caller's OWN store under
 * self-scope RLS (stores_public seller_id branch) via the cookie client, plus
 * the bilingual category pickers and the public media bucket name, then hands
 * them to the client form. Middleware already gates every /seller* route
 * (role=seller + R-S04 status routing); this page does not re-implement it.
 *
 * This route is the target of the T05 resubmit "edit store" link — creating it
 * closes that dangling in-scope link.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnStore } from "@/features/store-management";
import { getCategoryTree } from "@/features/discovery";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { StoreProfileForm } from "./_components/StoreProfileForm";
import type { CategoryOption } from "./_components/StoreProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.store");
  return { title: `${t("metaTitle")} — BETK` };
}

const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? "media";

export default async function StoreProfilePage() {
  const t = await getTranslations("seller.store");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const store = await getOwnStore(supabase);

  if (!store) {
    // Defensive: a seller should always have a store (ADR-012 atomic submit).
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
        <EmptyState message={t("empty.message")} hint={t("empty.hint")} />
      </div>
    );
  }

  // Bilingual category pickers — flatten the active taxonomy (parents + children)
  // into value(slug)/labelAr/labelEn options (stored as text per the schema).
  const tree = await getCategoryTree(supabase);
  const categories: CategoryOption[] = [];
  for (const node of tree) {
    categories.push({ value: node.slug, labelAr: node.nameAr, labelEn: node.nameEn ?? node.nameAr });
    for (const child of node.children) {
      categories.push({
        value: child.slug,
        labelAr: child.nameAr,
        labelEn: child.nameEn ?? child.nameAr,
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("title")}</h1>
      <StoreProfileForm
        uid={user.id}
        mediaBucket={MEDIA_BUCKET}
        categories={categories}
        store={{
          nameAr: store.name_ar,
          nameEn: store.name_en ?? "",
          bioAr: store.bio_ar ?? "",
          slug: store.slug,
          slugLocked: store.slug_changed_at !== null,
          categoryPrimary: store.category_primary,
          categorySecondary: store.category_secondary ?? "",
          governorate: store.governorate,
          city: store.city ?? "",
          minOrderEgp: store.min_order_egp !== null ? String(store.min_order_egp) : "",
          avatarUrl: store.avatar_url ?? "",
          coverUrl: store.cover_url ?? "",
        }}
      />
    </div>
  );
}
