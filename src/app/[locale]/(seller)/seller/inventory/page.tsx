/**
 * Stock & Inventory (`/seller/inventory`) — Phase 05 / T05 (FR-SEL-10).
 *
 * Seller-console page (renders inside the `(seller)` group's `SellerChrome`
 * shell). Dynamic/authed: reads the caller's OWN non-removed listings via the
 * T02 `getOwnInventory` query under the cookie client — RLS `listings_seller`
 * + a server-verified own-store pin (T02 `_shared`). Middleware already gates
 * every `/seller*` route; this page does not re-implement it.
 *
 * OD-1 — low-stock is DERIVED, not stored: this page (via `InventoryTable`'s
 * `StockBadge` composition) reads `stock_qty <= low_stock_threshold` at
 * render time. No `inventory_alerts`/alerts table exists or is added; no new
 * query mechanism beyond this one lean additive `getOwnInventory` read.
 *
 * "Buyers waiting" restock-alert count is DEFERRED (`restock_alerts` is
 * RLS-default-deny and owned by Phase 12 / notifications, per the ERD §3
 * map) — rendered WITHOUT that count. No policy is added here, no
 * service-role bypass is used.
 *
 * Two empty states: (1) the seller has no listings at all (reuses
 * `seller.listings.empty.*` — same "nothing yet" case as Listings
 * Management); (2) the seller has listings but every one is a `service` —
 * there is nothing to stock-manage (`seller.inventory.empty.servicesOnly*`).
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnInventory } from "@/features/listings";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared";
import { routes } from "@/constants/routes";
import { InventoryTable } from "./_components/InventoryTable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seller.inventory");
  return { title: `${t("metaTitle")} — BETK` };
}

export default async function SellerInventoryPage() {
  const t = await getTranslations("seller.inventory");
  const tListings = await getTranslations("seller.listings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive: middleware already gates this route to authenticated sellers.
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const items = await getOwnInventory(supabase);
  const hasProducts = items.some((item) => item.type === "product");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("title")}</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            variant="default"
            message={tListings("empty.message")}
            hint={tListings("empty.hint")}
          />
          <Button asChild size="sm">
            <Link href={routes.seller.listingNew}>{tListings("newCta")}</Link>
          </Button>
        </div>
      ) : !hasProducts ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            variant="default"
            message={t("empty.servicesOnlyMessage")}
            hint={t("empty.servicesOnlyHint")}
          />
          <Button asChild size="sm" variant="outline">
            <Link href={routes.seller.listingNew}>{tListings("newCta")}</Link>
          </Button>
        </div>
      ) : (
        <InventoryTable items={items} />
      )}
    </div>
  );
}
