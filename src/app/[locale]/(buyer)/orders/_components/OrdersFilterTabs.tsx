"use client";

/**
 * OrdersFilterTabs — the status filter tabs for `/orders` (Phase 07 / T04,
 * UI_SPEC "Order History" L260 "Filter tabs by status"). Composes the
 * CD-DELTA-4 kit `Tabs` (underline variant — the default; UI_SPEC does not pin
 * pill vs underline for this screen) — no hand-rolled tab strip, zero
 * `components/shared` edits. Mirrors the `ListingsFilterTabs` precedent
 * (Phase 05 / T03) exactly, minus per-tab counts (see the page header comment
 * for why counts are omitted here).
 *
 * URL-driven (search-page / seller-listings precedent): switching tabs
 * `router.push`es a plain query string via `@/i18n/navigation`; this is a
 * dynamic/authed console-style route (no ISR concern).
 */

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Tabs } from "@/components/shared";
import { routes } from "@/constants/routes";
import type { OrderStatusFilter } from "@/validations/orders";

const STATUS_ORDER: OrderStatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
];

export interface OrdersFilterTabsProps {
  currentStatus: OrderStatusFilter;
}

export function OrdersFilterTabs({ currentStatus }: OrdersFilterTabsProps) {
  const t = useTranslations("orders");
  const router = useRouter();

  const tabs = STATUS_ORDER.map((id) => ({ id, label: t(`filter.${id}`) }));

  return (
    <Tabs
      tabs={tabs}
      value={currentStatus}
      ariaLabel={t("title")}
      onValueChange={(id) => {
        const next = id === "all" ? routes.buyer.orders : `${routes.buyer.orders}?status=${id}`;
        router.push(next);
      }}
    />
  );
}
