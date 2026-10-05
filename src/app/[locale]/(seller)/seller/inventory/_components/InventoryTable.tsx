"use client";

/**
 * Inventory — P33. DataTable is the list. rowHref is the edit route from
 * the route helper. The kit renders that as a link in the first cell. There
 * is no row click handler. Stock edits stay outside the table: DataTable
 * cells are strings, and the kit is not restyled.
 *
 * updateStock is imported by file path, not the feature barrel.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { catalogStockLabels, catalogStockRemainingLabel } from "@/i18n/catalogLabels";
import { withLocale } from "@/constants/routes";
import { routes } from "@/constants/routes";
import { updateStock } from "@/features/listings/actions/updateStock";
import type { OwnInventoryItem } from "@/features/listings";
import { DataTable, StockBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface InventoryTableProps {
  items: OwnInventoryItem[];
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
  const products = items.filter((item) => item.type === "product");

  const rows = items.map((item) => {
    const title = localizedName({ ar: item.titleAr, en: item.titleEn }, locale);
    const isService = item.type === "service";
    return {
      id: item.id,
      title,
      stock: isService ? tListings("stockNotTracked") : String(item.stockQty ?? "—"),
      threshold: isService ? tListings("stockNotTracked") : String(item.lowStockThreshold),
      status: tListings(`filter.${item.status}`),
      touched: item.stockTouchedAt ? item.stockTouchedAt.slice(0, 10) : "—",
    };
  });

  function draftValue(item: OwnInventoryItem): string {
    return drafts[item.id] ?? String(item.stockQty ?? 0);
  }

  function handleFailure(res: { reason: string; code?: string }) {
    if (res.reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (res.reason === "blocked") {
      router.push("/blocked");
      return;
    }
    if (res.reason === "not_found") {
      toast.error(tListings("actions.notFound"));
      return;
    }
    if (res.reason === "refused" && res.code) {
      toast.error(tListings(`form.refusal.${res.code}`));
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
      handleFailure(res);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DataTable
        columns={[
          { id: "title", header: tListings("columns.listing") },
          { id: "stock", header: tListings("columns.stock"), ltr: true },
          { id: "threshold", header: t("columns.threshold"), ltr: true },
          { id: "status", header: tListings("columns.status") },
          { id: "touched", header: t("columns.touched"), ltr: true },
        ]}
        rows={rows}
        rowKey="id"
        rowHref={(row) => {
          const id = row.id;
          return id ? withLocale(routes.seller.listingEdit(id), locale) : undefined;
        }}
        caption={t("table.caption")}
        emptyLabel={t("table.empty")}
        errorLabel={t("table.error")}
        retryLabel={t("table.retry")}
        previousLabel={t("table.previous")}
        nextLabel={t("table.next")}
      />

      {products.length > 0 && (
        <ul className="flex flex-col gap-3">
          {products.map((item) => {
            const title = localizedName({ ar: item.titleAr, en: item.titleEn }, locale);
            const isPending = pendingId === item.id;
            const isSoldOut = item.status === "sold_out";
            const remainingLabel =
              typeof item.stockQty === "number"
                ? catalogStockRemainingLabel(tCatalog, item.stockQty)
                : undefined;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</span>
                <StockBadge
                  isMadeToOrder={item.isMadeToOrder}
                  stockQty={item.stockQty}
                  lowStockThreshold={item.lowStockThreshold}
                  labels={stockLabels}
                  remainingLabel={remainingLabel}
                />
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  dir="ltr"
                  disabled={isPending}
                  value={draftValue(item)}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="h-8 w-20 px-2 py-1 text-sm"
                  aria-label={tListings("columns.stock")}
                />
                <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleSave(item)}>
                  {isSoldOut ? t("actions.restock") : t("actions.save")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
