"use client";

/**
 * ListingsList — the Listings Management table/grid rows (Phase 05 / T03,
 * FR-SEL-8). Composes `StatusBadge`/`PriceBlock`/`ConfirmDialog` (kit) + `ui`
 * primitives; a responsive CSS-grid row (desktop) that collapses to a
 * labeled stacked card (mobile) — structural composition, not a new styled
 * DS component (Field-wrapper / T04-onboarding precedent).
 *
 * Row actions import the T02 Server Actions DIRECTLY from their file path
 * (never the `@/features/listings` barrel — the barrel also re-exports the
 * `@/lib/supabase/server`-backed queries, which would leak `next/headers`
 * into this client bundle; DeliverySettingsForm precedent, Phase 04 / T07).
 *
 * Per-status action availability (an engineering judgment call, not a spec
 * citation — UI_SPEC doesn't enumerate this): pause only from `active`,
 * unpause only from `paused` (mirrors the T02 `pauseListing`/`unpauseListing`
 * guards exactly); edit + delete are hidden on an already-`removed` row (a
 * terminal state — R-L10 specs no seller-side restore, admin-only Phase 14).
 * Deleting an already-actioned row never happens from the UI (the button is
 * hidden), but `softDeleteListing` is idempotent regardless.
 *
 * Every mutation calls `router.refresh()` on success so the tab counts
 * (sibling `ListingsFilterTabs`, same RSC parent) and the row list re-fetch
 * from the server together — no client-side cache to keep in sync by hand.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import { pauseListing, unpauseListing } from "@/features/listings/actions/pauseListing";
import { softDeleteListing } from "@/features/listings/actions/softDeleteListing";
import type { OwnListingRow } from "@/features/listings";
import { StatusBadge, PriceBlock, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";

export interface ListingsListProps {
  items: OwnListingRow[];
}

/** Mobile-only inline field label (desktop relies on the grid header row). */
function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground sm:hidden">{children}</span>;
}

const GRID = "gap-3 sm:grid sm:grid-cols-[minmax(12rem,2fr)_5rem_6.5rem_4.5rem_7rem_4rem_5rem_auto] sm:items-center sm:gap-4";

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
    // eslint-disable-next-line @next/next/no-img-element -- media bucket public URL, domain not configured for next/image (ListingCard precedent)
    <img src={url} alt="" loading="lazy" className="size-12 shrink-0 rounded-md object-cover" />
  );
}

export function ListingsList({ items }: ListingsListProps) {
  const t = useTranslations("seller.listings");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<OwnListingRow | null>(null);

  function handleFailure(reason: string, kind: "pause" | "unpause" | "delete") {
    if (reason === "unauthenticated") {
      router.push(routes.auth.login);
      return;
    }
    if (reason === "blocked") {
      router.push("/blocked");
      return;
    }
    if (reason === "not_found") {
      toast.error(t("actions.notFound"));
      return;
    }
    const key =
      kind === "delete" ? "actions.deleteFailed" : kind === "unpause" ? "actions.activateFailed" : "actions.pauseFailed";
    toast.error(t(key));
  }

  async function runPause(item: OwnListingRow) {
    setPendingId(item.id);
    try {
      const res = await pauseListing({ listingId: item.id });
      if (res.ok) {
        toast.success(t("actions.paused"));
        router.refresh();
        return;
      }
      handleFailure(res.reason, "pause");
    } finally {
      setPendingId(null);
    }
  }

  async function runUnpause(item: OwnListingRow) {
    setPendingId(item.id);
    try {
      const res = await unpauseListing({ listingId: item.id });
      if (res.ok) {
        toast.success(t("actions.activated"));
        router.refresh();
        return;
      }
      handleFailure(res.reason, "unpause");
    } finally {
      setPendingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    try {
      const res = await softDeleteListing({ listingId: deleteTarget.id });
      if (res.ok) {
        toast.success(t("actions.deleted"));
        setDeleteTarget(null);
        router.refresh();
        return;
      }
      handleFailure(res.reason, "delete");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col rounded-md border border-border bg-card">
      <div className={`hidden border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground ${GRID}`}>
        <span>{t("columns.listing")}</span>
        <span>{t("columns.type")}</span>
        <span>{t("columns.price")}</span>
        <span>{t("columns.stock")}</span>
        <span>{t("columns.status")}</span>
        <span>{t("columns.views")}</span>
        <span>{t("columns.inquiries")}</span>
        <span className="text-end">{t("columns.actions")}</span>
      </div>

      {items.map((item) => {
        const title = localizedName({ ar: item.titleAr, en: item.titleEn }, locale);
        const isPending = pendingId === item.id;
        const canEdit = item.status !== "removed";
        const canPause = item.status === "active";
        const canUnpause = item.status === "paused";
        const canDelete = item.status !== "removed";
        const stockDisplay =
          item.type === "service" || item.stockQty === null ? t("stockNotTracked") : item.stockQty;

        return (
          <div key={item.id} className={`flex flex-col border-b border-border p-3 last:border-b-0 ${GRID}`}>
            <div className="flex min-w-0 items-center gap-3">
              <ListingThumb url={item.heroImageUrl} />
              <div className="flex min-w-0 flex-col">
                {canEdit ? (
                  <Link
                    href={routes.seller.listingEdit(item.id)}
                    className="truncate font-display text-sm font-semibold text-foreground hover:underline"
                  >
                    {title}
                  </Link>
                ) : (
                  <span className="truncate font-display text-sm font-semibold text-foreground">{title}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.type")}</CellLabel>
              <span className="text-sm text-muted-foreground">{t(`type.${item.type}`)}</span>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.price")}</CellLabel>
              <PriceBlock price={item.price} priceType={item.priceType} size="sm" />
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.stock")}</CellLabel>
              <span className="font-mono text-sm text-foreground" dir="ltr">
                {stockDisplay}
              </span>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.status")}</CellLabel>
              <StatusBadge domain="listing" status={item.status} label={t(`filter.${item.status}`)} />
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.views")}</CellLabel>
              <span className="font-mono text-sm text-foreground" dir="ltr">
                {item.viewCount}
              </span>
            </div>

            <div className="flex items-center justify-between sm:block">
              <CellLabel>{t("columns.inquiries")}</CellLabel>
              <span className="font-mono text-sm text-foreground" dir="ltr">
                {item.inquiryCount}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {canEdit && (
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.seller.listingEdit(item.id)}>{t("actions.edit")}</Link>
                </Button>
              )}
              {canPause && (
                <Button variant="outline" size="sm" disabled={isPending} onClick={() => runPause(item)}>
                  {t("actions.pause")}
                </Button>
              )}
              {canUnpause && (
                <Button variant="outline" size="sm" disabled={isPending} onClick={() => runUnpause(item)}>
                  {t("actions.unpause")}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => setDeleteTarget(item)}
                >
                  {t("actions.delete")}
                </Button>
              )}
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("actions.deleteConfirmTitle")}
        message={t("actions.deleteConfirmMessage")}
        confirmLabel={t("actions.deleteConfirmConfirm")}
        cancelLabel={t("actions.deleteConfirmCancel")}
        destructive
        loading={deleteTarget !== null && pendingId === deleteTarget.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
