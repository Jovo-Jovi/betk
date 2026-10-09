/**
 * /cart — P66. Authenticated buyer. Middleware gates the prefix; this page
 * also requires an active account. Denial redirects. notFound is not used.
 *
 * Goods subtotal and a delivery line that delivery is calculated at checkout
 * (R-DELIVERY). No delivery figure. No grand total. No order is placed here.
 */

import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { catalogPriceLabels } from "@/i18n/catalogLabels";
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { getCartPage } from "@/features/cart/queries/getCartPage";
import { CartPageError, CartView } from "./_components/CartView";

interface RouteParams {
  locale: string;
}

export default async function CartPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  try {
    await requireActiveUser();
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      redirect(routes.auth.login as Route);
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      redirect("/blocked" as Route);
    }
    throw err;
  }

  const t = await getTranslations({ locale, namespace: "cart" });
  const catalogT = await getTranslations({ locale, namespace: "catalog" });
  const currencyLabel = catalogPriceLabels(catalogT).currency;
  const data = await getCartPage(locale, {
    listing: t("listingFallback"),
    store: t("storeFallback"),
  });

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-h2 font-bold text-foreground">{t("pageTitle")}</h1>
      {data.ok ? (
        <CartView lines={data.lines} dropped={data.dropped} currencyLabel={currencyLabel} />
      ) : (
        <CartPageError />
      )}
    </div>
  );
}
