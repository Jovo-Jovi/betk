/**
 * P10 Addresses — `/account/addresses` (BETK_UI_SPEC.md §5.3).
 *
 * Authenticated buyer. Middleware gates `/account`. This page also requires
 * an active account. Denial redirects. notFound is not used.
 *
 * Own address CRUD under `addr_self`. The kit AddressForm is composed and
 * not restyled. fullName and phone are not written.
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
import type { AppLocale } from "@/i18n/routing";
import { routes } from "@/constants/routes";
import { getOwnAddresses } from "@/features/buyer-account/queries/getOwnAddresses";
import { AddressBook, AddressPageError } from "./_components/AddressBook";

interface RouteParams {
  locale: string;
}

export default async function AddressesPage({ params }: { params: Promise<RouteParams> }) {
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

  const t = await getTranslations({ locale, namespace: "addresses" });

  let addresses;
  try {
    addresses = await getOwnAddresses();
  } catch {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <h1 className="font-display text-lg font-bold text-foreground">{t("pageTitle")}</h1>
        <AddressPageError />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <h1 className="font-display text-lg font-bold text-foreground">{t("pageTitle")}</h1>
      <AddressBook addresses={addresses} />
    </div>
  );
}
