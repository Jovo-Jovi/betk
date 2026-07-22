"use client";

/**
 * ListingsFilterTabs — the status filter tabs for `/seller/listings`
 * (Phase 05 / T03, FR-SEL-8). Composes the CD-DELTA-4 kit `Tabs` (pill
 * variant, per-tab `count` slot) — no hand-rolled tab strip, zero
 * `components/shared` edits.
 *
 * Consumes the T00-pre-wired `seller.listings.filter.*` keys verbatim (6
 * keys: all/active/draft/paused/sold_out/removed — CD-DELTA-4 LAND, parity
 * 530/530 at the time). "all" is the getOwnListings default/first tab; the
 * remaining 5 follow the UI_SPEC order (draft/active/sold_out/paused/removed).
 *
 * URL-driven (search page precedent — plain `router.push` with a manually
 * built query string via `@/i18n/navigation`, no `as Route` cast needed):
 * switching tabs resets to page 1 and re-runs the RSC page's own-store query
 * server-side. This is a dynamic/authed console route (no ISR concern).
 */

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Tabs } from "@/components/shared";
import { routes } from "@/constants/routes";
import type { ListingStatusFilter } from "@/validations/listings";
import type { OwnListingsStatusCounts } from "@/features/listings";

const STATUS_ORDER: ListingStatusFilter[] = ["all", "draft", "active", "sold_out", "paused", "removed"];

export interface ListingsFilterTabsProps {
  currentStatus: ListingStatusFilter;
  counts: OwnListingsStatusCounts;
}

export function ListingsFilterTabs({ currentStatus, counts }: ListingsFilterTabsProps) {
  const t = useTranslations("seller.listings");
  const router = useRouter();

  const tabs = STATUS_ORDER.map((id) => ({
    id,
    label: t(`filter.${id}`),
    count: counts[id],
  }));

  return (
    <Tabs
      tabs={tabs}
      value={currentStatus}
      variant="pill"
      ariaLabel={t("title")}
      onValueChange={(id) => {
        const next = id === "all" ? routes.seller.listings : `${routes.seller.listings}?status=${id}`;
        router.push(next);
      }}
    />
  );
}
