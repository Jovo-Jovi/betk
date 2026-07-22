"use client";

/**
 * SellerInboxFilterTabs — the status filter tabs for `/seller/inbox`
 * (Phase 06 / T04, FR-SEL-13). Composes the CD-DELTA-4 kit `Tabs` (pill
 * variant, per-tab `count` slot) AS-IS — the `ListingsFilterTabs`
 * (Phase 05 / T03) precedent, zero `components/shared` edits.
 *
 * Tab labels reuse `inbox.status.*` (buyer namespace) verbatim for the 5
 * concrete `inquiry_status` members — the label is a fact about the
 * inquiry's state, not a buyer/seller perspective, so the same string is
 * correct on both surfaces (only "all" is seller-inbox-specific, minted
 * under `seller.inbox.filter.all`).
 *
 * URL-driven (search-page / `ListingsFilterTabs` precedent): switching tabs
 * pushes `?status=` and re-runs the RSC page's own-store query server-side —
 * this is a dynamic/authed console route, no ISR concern.
 */

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Tabs } from "@/components/shared";
import { routes } from "@/constants/routes";
import type { InquiryStatusFilter } from "@/features/messaging";
import type { StoreInquiriesStatusCounts } from "@/features/messaging";

const STATUS_ORDER: InquiryStatusFilter[] = ["all", "open", "replied", "confirmed", "declined", "expired"];

export interface SellerInboxFilterTabsProps {
  currentStatus: InquiryStatusFilter;
  counts: StoreInquiriesStatusCounts;
}

export function SellerInboxFilterTabs({ currentStatus, counts }: SellerInboxFilterTabsProps) {
  const t = useTranslations("seller.inbox");
  const tInbox = useTranslations("inbox");
  const router = useRouter();

  const tabs = STATUS_ORDER.map((id) => ({
    id,
    label: id === "all" ? t("filter.all") : tInbox(`status.${id}`),
    count: counts[id],
  }));

  return (
    <Tabs
      tabs={tabs}
      value={currentStatus}
      variant="pill"
      ariaLabel={t("title")}
      onValueChange={(id) => {
        const next = id === "all" ? routes.seller.inbox : `${routes.seller.inbox}?status=${id}`;
        router.push(next);
      }}
    />
  );
}
