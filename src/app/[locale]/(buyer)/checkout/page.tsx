/**
 * /checkout — Phase 07 / T03 (AC-BUY-6, UI_SPEC §"Checkout" L231-241).
 * Protected by the T10 middleware (buyer gate — any authenticated user).
 *
 * STEP 0 (BL-01-FIX / REG-46 class): no `loading.tsx` sits at or above this
 * segment — `(buyer)/loading.tsx` was already deleted (REG-46); a fresh sweep
 * of `(buyer)/checkout/**` confirms none was added here. This page never calls
 * `notFound()` itself (every bad-state branch below is a `redirect()`, not a
 * 404), so the BL-01-FIX class does not even apply, but the sweep is stated
 * per the task's STEP 0 requirement.
 *
 * ENTRY SHAPE (cite UI_SPEC L232): `/checkout?inquiry=[inquiryId]`. `getCheckoutContext`
 * (T02b) is buyer-pinned (`buyer_id = self`) — a foreign/unknown/malformed
 * inquiry id reads zero rows → `null` (RLS-default-deny-is-the-404 precedent,
 * REG-46 class), which this page treats as UI_SPEC's "Invalid/expired inquiry
 * → redirect to inbox" edge case. A REAL but non-`confirmed` inquiry (open/
 * replied/declined/expired) is routed back to ITS OWN thread, which already
 * renders the correct per-status guidance banner (declined/expired read-only,
 * etc.) — no separate "message" mechanism is invented for this redirect
 * (dead-link-rule precedent: reuse an existing guidance surface, don't build
 * a new one for a single edge case).
 *
 * ALREADY-CONVERTED: `convertedToOrderId` is set → idempotent redirect straight
 * to the confirmation page for the existing order (never re-run checkout).
 *
 * COMMISSION (E2, cite-or-flag): `getCheckoutContext`'s `CheckoutAmounts` shape
 * has NO commission field at all (checkoutRules/types.ts header) — it is a
 * BETK↔seller concern, never rendered to the buyer. This page does not read
 * `commission_rate_pct` (nor could it — `settings_payment_config_read`, REG-69,
 * returns ZERO ROWS for that key to a non-admin, never an error).
 */

import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCheckoutContext } from "@/features/checkout/queries/getCheckoutContext";
import { getOwnAddresses } from "@/features/buyer-account/queries/getOwnAddresses";
import { routes } from "@/constants/routes";
import type { AppLocale } from "@/i18n/routing";
import { CheckoutForm } from "./_components/CheckoutForm";

interface RouteParams {
  locale: string;
}
interface RawSearchParams {
  inquiry?: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: `${t("metaTitle")} — BETK` };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const sp = await searchParams;
  const inquiryId = sp.inquiry;

  if (!inquiryId) {
    redirect(routes.buyer.inbox as Route);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(routes.auth.login as Route);
  }

  const context = await getCheckoutContext(inquiryId, supabase);

  // Foreign / unknown / malformed inquiry → UI_SPEC "invalid inquiry" edge case.
  if (!context) {
    redirect(routes.buyer.inbox as Route);
  }

  // Idempotent — already converted, never re-run checkout.
  if (context.convertedToOrderId) {
    redirect(routes.buyer.checkoutConfirmation(context.convertedToOrderId) as Route);
  }

  // Not (or no longer) confirmed, or the listing is gone → back to the thread,
  // which already renders the right per-status guidance (no new message UI).
  if (context.status !== "confirmed" || !context.listing) {
    redirect(routes.buyer.inboxThread(context.inquiryId) as Route);
  }

  const addresses = await getOwnAddresses(supabase);

  const t = await getTranslations({ locale, namespace: "checkout" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
      <CheckoutForm context={context} initialAddresses={addresses} locale={locale} />
    </div>
  );
}
