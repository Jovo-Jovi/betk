/**
 * Payment Methods Settings (/seller/store/payments) — Phase 04 / T07
 * (FR-SEL-7 / R-S09 config).
 *
 * Seller-console page (inside the `(seller)` group → renders with the
 * ConsoleSidebar shell). Dynamic/authed: reads the caller's OWN
 * `payment_methods` under self-scope RLS (stores_public seller_id branch)
 * via the cookie client, then hands it to the client form. Middleware
 * already gates every /seller* route (role=seller + R-S04 status routing);
 * this page does not re-implement it.
 *
 * R-S09 (≥1 payment method required to PUBLISH a listing): this page is
 * CONFIG + WARNING BANNER only — see the banner comment in the form
 * component. Enforcement lives at the Phase-05 listing-publish gate.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnStorePayments } from "@/features/store-management";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { PaymentsSettingsForm } from "./_components/PaymentsSettingsForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.store");
  return { title: `${t("payments.metaTitle")} — BETK` };
}

export default async function PaymentsSettingsPage() {
  const t = await getTranslations("seller.store");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const store = await getOwnStorePayments(supabase);

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
      <h1 className="font-display text-lg font-bold text-foreground">{t("payments.title")}</h1>
      <PaymentsSettingsForm payments={store.paymentMethods} />
    </div>
  );
}
