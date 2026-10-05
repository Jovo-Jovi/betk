/**
 * Pickup address (/seller/store/delivery) — P27 (FR-SEL-5).
 *
 * Writes store_pickup_addresses. Does not read or write stores.delivery_options.
 * No delivery-mode toggles (OD-10).
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnStorePickup } from "@/features/store-management";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { PickupAddressForm } from "./_components/PickupAddressForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.store");
  return { title: `${t("delivery.metaTitle")} — BETK` };
}

export default async function PickupAddressPage() {
  const t = await getTranslations("seller.store");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const store = await getOwnStorePickup(supabase);

  if (!store) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 md:px-6">
        <EmptyState message={t("empty.message")} hint={t("empty.hint")} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8" data-slot="pickup-page">
      <h1 className="font-display text-lg font-bold text-foreground">{t("delivery.title")}</h1>
      <PickupAddressForm
        governorate={store.pickup?.governorate ?? store.governorate}
        city={store.pickup?.city ?? store.city ?? ""}
        streetAddress={store.pickup?.streetAddress ?? ""}
        buildingNotes={store.pickup?.buildingNotes ?? ""}
      />
    </div>
  );
}
