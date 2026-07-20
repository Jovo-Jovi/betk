/**
 * Return Policy Settings (/seller/store/returns) — Phase 04 / T07 (FR-SEL-6).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell). Dynamic/authed: reads the caller's OWN
 * `return_policy` under self-scope RLS (stores_public seller_id branch) via
 * the cookie client, then hands it to the client form. Middleware already
 * gates every /seller* route (role=seller + R-S04 status routing); this page
 * does not re-implement it.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnStoreReturns } from "@/features/store-management";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { ReturnsSettingsForm } from "./_components/ReturnsSettingsForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.store");
  return { title: `${t("returns.metaTitle")} — BETK` };
}

export default async function ReturnsSettingsPage() {
  const t = await getTranslations("seller.store");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const store = await getOwnStoreReturns(supabase);

  if (!store) {
    // Defensive: a seller should always have a store (ADR-012 atomic submit).
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
        <EmptyState message={t("empty.message")} hint={t("empty.hint")} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("returns.title")}</h1>
      <ReturnsSettingsForm returnPolicy={store.returnPolicy ?? ""} />
    </div>
  );
}
