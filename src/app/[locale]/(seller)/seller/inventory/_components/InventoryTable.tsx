"use client";

/**
 * InventoryTable — the Stock & Inventory rows (Phase 05 / T05, FR-SEL-10).
 * Responsive CSS-grid row (desktop) that collapses to a labeled stacked card
 * (mobile) — structural composition mirroring `ListingsList` (T03), not a
 * new styled DS component.
 *
 * `updateStock` is imported DIRECTLY from its file path (never the
 * `@/features/listings` barrel — the barrel also re-exports the
 * `@/lib/supabase/server`-backed queries, which would leak `next/headers`
 * into this client bundle; `ListingsList`/`DeliverySettingsForm` precedent).
 *
 * R-L09 (services show no stock controls): a `service` row renders the
 * em-dash (`seller.listings.stockNotTracked`, the exact T03 precedent) for
 * BOTH the stock and threshold cells and has NO inline editor / restock
 * button at all — `updateStock` already rejects a service server-side
 * (T02-proven `invalid`), so this is a UI-only mirror of an already-enforced
 * rule, not a new guard. (`getOwnInventory` does not select `price_type`, so
 * a `quote_only` product cannot be distinguished here — out of scope for
 * this lean additive query; only `type='service'` drives the no-controls
 * branch.)
 *
 * R-L07 (restock, sold_out→active): the SAME `updateStock` action is used
 * for every product row; when the row's status is `sold_out` the button
 * label swaps to "Restock" instead of "Save" (communicating the flip that
 * happens server-side when the new quantity is > 0) — no separate action.
 *
 * OD-1 (low-stock is DERIVED): the `StockBadge` composition below derives
 * in_stock/low/sold_out/made_to_order purely from `stockQty` vs
 * `lowStockThreshold` at render time (no alerts table, no stored history).
 *
 * "Buyers waiting" restock-alert count is DEFERRED to Phase 12
 * (`restock_alerts` is RLS-default-deny, notifications-owned per the ERD §3
 * map) — intentionally absent from this row, not wired around.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { catalogStockLabels, catalogStockRemainingLabel } from "@/i18n/catalogLabels";
import { routes } from "@/constants/routes";
import { updateStock } from "@/features/listings/actions/updateStock";
import type { OwnInventoryItem } from "@/features/listings";
import { StatusBadge, StockBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface InventoryTableProps {
  items: OwnInventoryItem[];
}

/** Mobile-only inline field label (desktop relies on the grid header row). */
function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground sm:hidden">{children}</span>;
}

const GRID = "gap-3 sm:grid sm:grid-cols-[minmax(12rem,2fr)_5rem_10rem_6rem_7rem_auto] sm:items-center sm:gap-4";

function ListingThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="m3 16 4.5-4.5a2 2 0 0 1 2.8 0L15 16" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- media bucket public URL (ListingsList precedent)
    <img src={url} alt="" loading="lazy" className="size-12 shrink-0 rounded-md object-cover" />
  );
}

export function InventoryTable({ items: initialItems }: InventoryTableProps) {
  const t = useTranslations("seller.inventory");
  const tListings = useTranslations("seller.listings");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [items, setItems] = React.useState(initialItems);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const stockLabels = catalogStockLabels(tCatalog);

  function draftValue(item: OwnInventoryItem): string {
    return drafts[item.id] ?? String(item.stockQty ?? 0);
  }

  function handleFailure(reason: string) {
    if (reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (reason === "blocked") {
      router.push("/blocked");
      return;
    }
    if (reason === "not_found") {
      toast.error(tListings("actions.notFound"));
      return;
    }
    toast.error(t("actions.updateFailed"));
  }

  async function handleSave(item: OwnInventoryItem) {
    const raw = draftValue(item);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      toast.error(t("actions.invalidQty"));
      return;
    }

    setPendingId(item.id);
    try {
      const res = await updateStock({ listingId: item.id, stockQty: parsed });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, stockQty: parsed, status: res.restocked ? "active" : i.status }
              : i,
          ),
        );
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        toast.success(res.restocked ? t("actions.restocked") : t("actions.stockUpdated"));
        return;
      }
      handleFailure(res.reason);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col rounded-md border border-border bg-card">
      <div className={`hidden border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground ${GRID}`}>
        <span>{tListings("columns.listing")}</span>
        <span>{tListings("columns.type")}</span>
        <span>{tListings("columns.stock")}</span>
        <span>{t("columns.threshold")}</span>
        <span>{tListings("columns.status")}</span>
        <span className="text-end">{tListings("columns.actions")}</span>
      </div>

      {items.map((item) => {
        const title = localizedName({ ar: item.titleAr, en: item.titleEn }, locale);
        const isService = item.type === "service";
        const isPending = pendingId === item.id;
        const isSoldOut = item.status === "sold_out";
        const remainingLabel =
          typeof item.stockQty === "number" ? catalogStockRemainingLabel(tCatalog, item.stockQty) : undefined;

        return (
          <div key={item.id} className={`flex flex-col border-b border-border p-3 last:border-b-0 ${GRID}`}>
            <div className="flex min-w-0 items-center gap-3">
              <ListingThumb url={item.heroImageUrl} />
              <Link
                href={routes.seller.listingEdit(item.id)}
                className="truncate font-display text-sm font-semibold text-foreground hover:underline"
              >
                {title}
              </Link>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{tListings("columns.type")}</CellLabel>
              <span className="text-sm text-muted-foreground">{tListings(`type.${item.type}`)}</span>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{tListings("columns.stock")}</CellLabel>
              {isService ? (
                <span className="font-mono text-sm text-muted-foreground" dir="ltr">
                  {tListings("stockNotTracked")}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground" dir="ltr">
                    {item.stockQty ?? "—"}
                  </span>
                  <StockBadge
                    isMadeToOrder={item.isMadeToOrder}
                    stockQty={item.stockQty}
                    lowStockThreshold={item.lowStockThreshold}
                    labels={stockLabels}
                    remainingLabel={remainingLabel}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.threshold")}</CellLabel>
              <span className="font-mono text-sm text-foreground" dir="ltr">
                {isService ? tListings("stockNotTracked") : item.lowStockThreshold}
              </span>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{tListings("columns.status")}</CellLabel>
              <StatusBadge domain="listing" status={item.status} label={tListings(`filter.${item.status}`)} />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {!isService && (
                <>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    inputMode="numeric"
                    dir="ltr"
                    disabled={isPending}
                    value={draftValue(item)}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="h-8 w-20 px-2 py-1 text-sm"
                    aria-label={tListings("columns.stock")}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSave(item)}
                  >
                    {isSoldOut ? t("actions.restock") : t("actions.save")}
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
