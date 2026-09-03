/**
 * /checkout/confirmation/[id] — Phase 07 / T03 (UI_SPEC "Order Confirmation &
 * Payment Instructions" L243-254). Protected by the T10 middleware (buyer gate).
 *
 * STEP 0 (BL-01-FIX / REG-46 class): no `loading.tsx` sits at or above this
 * segment (`(buyer)/loading.tsx` already deleted, REG-46; fresh sweep of
 * `(buyer)/checkout/**` confirms none was added). `notFound()` below runs
 * synchronously with no ancestor Suspense boundary, so its HTTP status commits
 * correctly (the exact fix REG-46 established).
 *
 * OUTSIDER / UNKNOWN / MALFORMED id → hard 404 BY STATUS CODE: `getOrderDetail`
 * (T02b) is buyer-pinned (`buyer_id = self`) — a foreign/unknown/malformed id
 * reads zero rows → `null` (RLS-default-deny-is-the-404 precedent), and this
 * page's only job on that is `notFound()`.
 *
 * BETK'S HANDLES, NOT THE STORE'S (custodial, OD-8/ADR-016): `getDepositHandles`
 * reads `admin_settings` via the `settings_payment_config_read` allow-list
 * (REG-69) — never `stores.payment_methods`. Only the handle matching the
 * DEPOSIT payment's OWN `method` is shown (the rail the buyer actually chose
 * at checkout), not all three.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/features/orders/queries/getOrderDetail";
import { getDepositHandles } from "@/features/checkout/queries/getDepositHandles";
import type { AppLocale } from "@/i18n/routing";
import { DepositProofPanel } from "@/features/checkout/components/DepositProofPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout.confirmation");
  return { title: `${t("metaTitle")} — BETK` };
}

interface RouteParams {
  locale: string;
  id: string;
}

const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";

export default async function CheckoutConfirmationPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, id } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const order = await getOrderDetail(id, supabase);
  if (!order || !user) {
    notFound();
  }

  const deposit = order.payments.find((p) => p.type === "deposit") ?? null;
  const balance = order.payments.find((p) => p.type === "balance") ?? null;

  const handles = await getDepositHandles();
  const handleByMethod: Record<string, string | null> = {
    instapay: handles.instapay,
    vodafone_cash: handles.vodafoneCash,
    orange_cash: handles.orangeCash,
  };
  const depositHandle = deposit ? handleByMethod[deposit.method] ?? null : null;

  const t = await getTranslations({ locale, namespace: "checkout.confirmation" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="font-display text-xl font-bold text-foreground">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("refLabel")}</p>
        <p dir="ltr" className="font-mono text-lg font-bold text-primary">{order.betkRef}</p>
      </div>

      {deposit && (
        <DepositProofPanel
          orderId={order.id}
          uid={user.id}
          deposit={deposit}
          depositHandle={depositHandle}
          docsBucket={DOCS_BUCKET}
        />
      )}

      {balance && (
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          {t("balanceNote")}
        </div>
      )}
    </div>
  );
}
