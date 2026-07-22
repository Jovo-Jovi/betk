"use client";

/**
 * ListingsPagination — Prev/Next paging for `/seller/listings` (Phase 05 /
 * T03). Offset-paginated per the T02 `getOwnListings` shape (page/pageSize),
 * not a cursor — URL-driven via `router.push` (LoadMoreLink precedent,
 * Phase 03 T06), same reasoning as `ListingsFilterTabs`: this console route
 * is dynamic/authed (no ISR), so a `searchParams`-driven page number is free
 * and keeps pages URL-addressable.
 */

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import type { ListingStatusFilter } from "@/validations/listings";

export interface ListingsPaginationProps {
  status: ListingStatusFilter;
  page: number;
  totalPages: number;
}

export function ListingsPagination({ status, page, totalPages }: ListingsPaginationProps) {
  const t = useTranslations("seller.listings");
  const router = useRouter();

  if (totalPages <= 1) return null;

  function hrefFor(nextPage: number): string {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return qs ? `${routes.seller.listings}?${qs}` : routes.seller.listings;
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => router.push(hrefFor(page - 1))}
      >
        {t("pagination.previous")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t("pagination.pageInfo", { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => router.push(hrefFor(page + 1))}
      >
        {t("pagination.next")}
      </Button>
    </div>
  );
}
