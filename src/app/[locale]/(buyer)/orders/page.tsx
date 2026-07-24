/**
 * /orders — Order History (Phase 07 / T04, UI_SPEC L255-265). Buyer-protected
 * (T10 middleware `/orders` → buyer gate, unchanged); this RSC does not
 * re-implement that gate.
 *
 * STEP 0 (BL-01-FIX / REG-46 class): no `loading.tsx` sits at or above this
 * segment — `(buyer)/loading.tsx` was already deleted (REG-46), and this
 * fresh sweep of `(buyer)/orders/**` confirms none was added by this task.
 *
 * `getOwnOrders` (T02b) is buyer-pinned (`buyer_id = self`) and returns the
 * FULL list (no `limit`/`offset` param on the query layer) — this compose-
 * only task does not extend that query, so PAGINATION (listed as a UI_SPEC
 * component) is OMITTED here rather than half-built against a query that
 * doesn't support it; a buyer's own order count is small in practice. Status
 * filter is READ from `?status=`, mirroring the `seller/listings` precedent.
 */

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOwnOrders } from "@/features/orders/queries/getOwnOrders";
import { orderStatusFilterSchema, type OrderStatusFilter } from "@/validations/orders";
import { EmptyState } from "@/components/shared";
import type { AppLocale } from "@/i18n/routing";
import { OrdersFilterTabs } from "./_components/OrdersFilterTabs";
import { OrderRow } from "./_components/OrderRow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: `${t("metaTitle")} — BETK` };
}

type RawSearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export default async function OrdersPage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const sp = await searchParams;
  const parsedStatus = orderStatusFilterSchema.safeParse(first(sp.status));
  const status: OrderStatusFilter = parsedStatus.success ? parsedStatus.data : "all";

  const [orders, t] = await Promise.all([
    getOwnOrders(status),
    getTranslations({ locale, namespace: "orders" }),
  ]);

  const currency = t("currency");
  const dateLocale = locale === "en" ? "en-EG" : "ar-EG";
  const isEmpty = orders.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("title")}</h1>

      <OrdersFilterTabs currentStatus={status} />

      {isEmpty ? (
        <EmptyState
          variant={status === "all" ? "default" : "filtered"}
          message={status === "all" ? t("empty.message") : t("empty.filteredMessage")}
          hint={status === "all" ? t("empty.hint") : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              locale={locale}
              currency={currency}
              statusLabel={t(`filter.${order.status}`)}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
