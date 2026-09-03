/**
 * /orders/[id] — Order Detail / Track Order (Phase 07 / T04, UI_SPEC L267-278).
 * Buyer-protected (T10 middleware, `/orders*` → buyer gate); this RSC does not
 * re-implement it.
 *
 * STEP 0 (BL-01-FIX / REG-46 class): no `loading.tsx` sits at or above this
 * segment — sweep of `(buyer)/orders/**` confirms none was added.
 *
 * OUTSIDER / UNKNOWN / MALFORMED id → hard 404 BY STATUS CODE: `getOrderDetail`
 * (T02b) is buyer-pinned (`buyer_id = self`), so a foreign/unknown/malformed id
 * resolves to `null` (RLS-default-deny-is-the-404 precedent; malformed UUID's
 * `22P02` is caught inside the query and also folded to `null`) — this page's
 * only job on that is `notFound()`.
 *
 * PAYMENT PANEL: the deposit row reuses `DepositProofPanel` VERBATIM (moved to
 * `src/features/checkout/components/` this task so both `/checkout/confirmation/
 * [id]` and here can compose it) — it already renders the exact three-state
 * machine (no proof / awaiting BETK verification / confirmed) AND the re-upload
 * affordance the pack asks for (R-S08, re-upload allowed while pending), so no
 * new upload UI is built here. The balance row is COD — informational only
 * (`checkout.confirmation.balanceNote`, reused rather than re-authored).
 *
 * TRACKING: renders an EMPTY-STATE unconditionally — `shipments` WRITE is
 * Phase 08 (binding rule §2); no shipment query is called here.
 *
 * ORDER-MESSAGES THREAD: OMITTED. `order_messages` exists ONLY in the
 * generated DB types (`src/lib/supabase/types.ts`) — there is no query/action
 * layer and no RLS policy audited for it in Phase 07 T02b. UI_SPEC pins a
 * thread on this screen, but building one would require a full new read/write
 * layer outside this compose-only task's scope (and outside T02b's delivered
 * surface) — cite-or-omit, per the pack's own instruction. Not the Phase-06
 * inquiry thread under a new name (do not conflate).
 *
 * REVIEW / DISPUTE ENTRY POINTS: guidance-only per the dead-link rule (Phase
 * 09/10 own `/orders/[id]/review` and `/orders/[id]/dispute/new`, both LATER
 * phases — not a same-phase forward reference, so no live Link is rendered).
 * Gated on the UI_SPEC eligibility (`delivered` for review, `delivered`/
 * `dispatched` for dispute) — which Phase 07 alone can never produce (those
 * transitions are Phase 08's), so in today's build this section never renders;
 * the gate is left in place so it activates correctly once Phase 08 ships
 * without a re-edit here.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/features/orders/queries/getOrderDetail";
import { getDepositHandles } from "@/features/checkout/queries/getDepositHandles";
import { DepositProofPanel } from "@/features/checkout/components/DepositProofPanel";
import { EmptyState, StatusBadge, OrderTimeline } from "@/components/shared";
import type { AppLocale } from "@/i18n/routing";
import { CancelOrderButton } from "./_components/CancelOrderButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: `${t("detailMetaTitle")} — BETK` };
}

interface RouteParams {
  locale: string;
  id: string;
}

const REVIEW_ELIGIBLE = new Set(["delivered"]);
const DISPUTE_ELIGIBLE = new Set(["delivered", "dispatched"]);
const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";

export default async function OrderDetailPage({ params }: { params: Promise<RouteParams> }) {
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

  const handles = await getDepositHandles(supabase);
  const handleByMethod: Record<string, string | null> = {
    instapay: handles.instapay,
    vodafone_cash: handles.vodafoneCash,
    orange_cash: handles.orangeCash,
  };
  const depositHandle = deposit ? handleByMethod[deposit.method] ?? null : null;

  const [t, tCheckout, tDelivery] = await Promise.all([
    getTranslations({ locale, namespace: "orders" }),
    getTranslations({ locale, namespace: "checkout.confirmation" }),
    getTranslations({ locale, namespace: "store.about.delivery.modes" }),
  ]);

  const currency = t("currency");
  const dateLocale = locale === "en" ? "en-EG" : "ar-EG";
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );

  const timelineSteps = order.timeline.map((entry, i) => ({
    id: entry.id,
    title: t(`detail.timeline.status.${entry.toStatus}`),
    time: fmtDate(entry.createdAt),
    state: i === order.timeline.length - 1 ? ("active" as const) : ("completed" as const),
  }));

  const showReview = REVIEW_ELIGIBLE.has(order.status);
  const showDispute = DISPUTE_ELIGIBLE.has(order.status);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span dir="ltr" className="font-mono text-sm font-bold text-primary">{order.betkRef}</span>
          <span dir="ltr" className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</span>
        </div>
        <StatusBadge domain="order" status={order.status} label={t(`filter.${order.status}`)} />
      </div>

      {/* ── Line items ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">{t("detail.items.title")}</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">{item.titleAr}</span>
            <span className="shrink-0 text-muted-foreground">× {item.quantity}</span>
            <span dir="ltr" className="shrink-0 font-mono text-foreground">
              {new Intl.NumberFormat("en-EG").format(item.subtotal)} {currency}
            </span>
          </div>
        ))}
      </section>

      {/* ── Delivery ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">{t("detail.delivery.title")}</h2>
        <p className="text-sm text-foreground">{tDelivery(order.deliveryMethod)}</p>
        {order.deliveryAddress && (
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{t("detail.address.title")}</p>
            <p>
              {order.deliveryAddress.streetAddress}, {order.deliveryAddress.city}, {order.deliveryAddress.governorate}
            </p>
            {order.deliveryAddress.buildingNotes && <p>{order.deliveryAddress.buildingNotes}</p>}
          </div>
        )}
      </section>

      {/* ── Payments (custodial — BETK's handles, never the store's) ─────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-bold text-foreground">{t("detail.payments.title")}</h2>
        {deposit && (
          <DepositProofPanel orderId={order.id} uid={user.id} deposit={deposit} depositHandle={depositHandle} docsBucket={DOCS_BUCKET} />
        )}
        {balance && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-foreground">{t("detail.payments.balanceTitle")}</p>
              <StatusBadge domain="payment" status={balance.status} />
            </div>
            <p dir="ltr" className="font-mono text-sm font-semibold text-foreground">
              {new Intl.NumberFormat("en-EG").format(balance.amount)} {currency}
            </p>
            <p className="text-sm text-muted-foreground">{tCheckout("balanceNote")}</p>
          </div>
        )}
      </section>

      {/* ── Timeline (order_status_history, real rows only — never synthesized) ─ */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-sm font-bold text-foreground">{t("detail.timeline.title")}</h2>
        <OrderTimeline steps={timelineSteps} />
      </section>

      {/* ── Tracking — always empty this phase (Phase 08 owns shipments WRITE) ─ */}
      <section className="rounded-lg border border-border bg-card">
        <h2 className="sr-only">{t("detail.tracking.title")}</h2>
        <EmptyState variant="default" message={t("detail.tracking.emptyMessage")} hint={t("detail.tracking.emptyHint")} />
      </section>

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {order.status === "pending" && <CancelOrderButton orderId={order.id} />}
        {showReview && (
          <span className="text-sm text-muted-foreground">{t("detail.postDelivery.reviewCta")}</span>
        )}
        {showDispute && (
          <span className="text-sm text-muted-foreground">{t("detail.postDelivery.disputeCta")}</span>
        )}
      </div>
    </div>
  );
}
