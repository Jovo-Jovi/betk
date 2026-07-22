/**
 * /seller/inbox/[id] — Seller Inbox thread (BETK_UI_SPEC.md L476-484, FR-SEL-13).
 * Phase 06 / T04. Inside the `(seller)` route group; middleware already gates
 * every `/seller*` route.
 *
 * STEP 0 (REG-46 lesson, checked FIRST): no `loading.tsx` exists at this
 * segment, the `(seller)` group, or any ancestor (`[locale]`/root) — a
 * repo-wide sweep for `loading.tsx` returned zero files (the `(buyer)` one
 * was already deleted closing REG-46; `[locale]/loading.tsx` was already
 * deleted closing BL-01-FIX). Nothing to remove; stated per the task's
 * explicit instruction to report either way. The `notFound()` decision below
 * still runs synchronously with no Suspense boundary between the route and
 * it, per the binding rule.
 *
 * OWNERSHIP (seller-only, beyond RLS): `getInquiryThread` returns a thread to
 * ANY participant (buyer OR owning store OR admin) — that's correct for the
 * BUYER route (`/inbox/[id]`), but this is the SELLER route, so a thread
 * whose caller is the BUYER (not the owning seller) must ALSO 404 here, not
 * just an unrelated outsider. `resolveCallerScope` (own store id) pins that:
 * no store at all, or a thread belonging to a DIFFERENT store (an unrelated
 * seller — already zero-rows via RLS, re-checked defensively) → `notFound()`.
 * A malformed/unknown id already returns `null` from `getInquiryThread`
 * (RLS default-deny IS the 404 — no existence leak).
 *
 * MESSAGES: `thread.messages` already carries the merged opening bubble as
 * its first entry (the T03 query-layer merge) — `MessageThread` composed
 * AS-IS, no splicing here.
 *
 * MARK-READ: `MarkThreadRead` (client, mount-effect, non-blocking, no
 * `router.refresh()`) — the T03 buyer-side component, duplicated verbatim
 * under this route's own `_components/` (private per-route-group folders
 * can't share across `(buyer)`/`(seller)`; the `Field.tsx`-per-folder
 * precedent already established this repo-wide duplication pattern).
 *
 * CONFIRM / DECLINE: `InquiryStatusActions` (client) wires `confirmInquiry` +
 * `declineInquiry` (T02, both built — UI_SPEC L481 pins the decline surface
 * too) behind `ConfirmDialog`s; both hidden once the inquiry is in a
 * terminal state (confirmed/declined/expired — T02's own guards are
 * idempotent regardless, this is a UI-only pre-check). `router.refresh()` on
 * success re-runs this page's own read.
 *
 * WHATSAPP / CONTACT (REG-45 symmetry): omitted on the seller side too — the
 * buyer's phone is equally RLS-unreachable from a thread party (mirrors
 * REG-45's buyer-side finding; `stores`/`users` expose no phone column to a
 * thread counterpart on either side).
 */

import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getInquiryThread } from "@/features/messaging/queries/getInquiryThread";
import { resolveCallerScope } from "@/features/messaging/queries/_shared";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import { Alert, StatusBadge, type ThreadMessage } from "@/components/shared";
import { MarkThreadRead } from "./_components/MarkThreadRead";
import { SellerThreadComposer } from "./_components/SellerThreadComposer";
import { InquiryStatusActions } from "./_components/InquiryStatusActions";

interface RouteParams {
  locale: string;
  id: string;
}

function formatTime(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-EG" : "ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function SellerInboxThreadPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, id } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const supabase = await createClient();
  const [thread, scope] = await Promise.all([
    getInquiryThread(id, supabase),
    resolveCallerScope(supabase),
  ]);

  if (!thread) {
    notFound();
  }
  // Seller-only: a buyer (or an unrelated seller — already covered by RLS
  // returning null above) reading THIS route must also 404.
  if (!scope || scope.storeId === null || scope.storeId !== thread.storeId) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "seller.inbox" });
  const tInbox = await getTranslations({ locale, namespace: "inbox" });
  const tDelivery = await getTranslations({ locale, namespace: "store.about.delivery.modes" });

  const statusLabels: Record<string, string> = {
    open: tInbox("status.open"),
    replied: tInbox("status.replied"),
    confirmed: tInbox("status.confirmed"),
    declined: tInbox("status.declined"),
    expired: tInbox("status.expired"),
  };

  const listingTitle = thread.listing
    ? localizedName({ ar: thread.listing.titleAr, en: thread.listing.titleEn }, locale)
    : tInbox("list.listingFallback");

  const isReadOnly = thread.status === "declined" || thread.status === "expired";

  const messages: ThreadMessage[] = thread.messages.map((m) => ({
    id: m.id,
    text: m.body,
    time: formatTime(m.sentAt, locale),
    sent: m.senderType === "seller",
  }));

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-4 px-4 py-6">
      <Link href={routes.seller.inbox} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; {tInbox("backToList")}
      </Link>

      {/* Listing context header (BETK_UI_SPEC.md L481 "listing/qty/special-requests context"). */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        {thread.listing ? (
          <Link href={routes.listing(thread.listing.id)} className="flex min-w-0 flex-1 items-center gap-3">
            {thread.listing.heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thread.listing.heroImageUrl} alt="" className="size-14 shrink-0 rounded-md object-cover" />
            )}
            <span className="min-w-0 truncate font-display text-sm font-bold text-foreground">
              {listingTitle}
            </span>
          </Link>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{listingTitle}</span>
        )}
        {/* REG-44 (authorized privacy decision): generic label, never the buyer's name. */}
        <span className="shrink-0 text-xs text-muted-foreground">{t("buyerLabel")}</span>
        <StatusBadge domain="inquiry" status={thread.status} label={statusLabels[thread.status]} />
      </div>

      {/* Composer extras (ADR-014 columns: quantity/delivery_preference/special_requests). */}
      {(thread.quantity !== null || thread.deliveryPreference !== null || thread.specialRequests) && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-3 text-sm">
          {thread.quantity !== null && (
            <span>
              <span className="text-muted-foreground">{tInbox("thread.quantityLabel")}: </span>
              <span className="font-semibold text-foreground">{thread.quantity}</span>
            </span>
          )}
          {thread.deliveryPreference !== null && (
            <span>
              <span className="text-muted-foreground">{tInbox("thread.deliveryLabel")}: </span>
              <span className="font-semibold text-foreground">{tDelivery(thread.deliveryPreference)}</span>
            </span>
          )}
          {thread.specialRequests && (
            <span>
              <span className="text-muted-foreground">{tInbox("thread.specialRequestsLabel")}: </span>
              <span className="font-semibold text-foreground">{thread.specialRequests}</span>
            </span>
          )}
        </div>
      )}

      {/* CONFIRMED-STATE — seller-facing guidance, no link (Phase 07 owns /checkout). */}
      {thread.status === "confirmed" && (
        <Alert
          variant="success"
          title={t("thread.confirmedBanner.title")}
          message={t("thread.confirmedBanner.message")}
        />
      )}

      {/* Declined/expired — read-only per BETK_UI_SPEC.md L226 (buyer-side copy reused, the
          fact is identical from either side: no new messages can be sent here). */}
      {thread.status === "declined" && (
        <Alert
          variant="destructive"
          title={tInbox("thread.closedBanner.declinedTitle")}
          message={tInbox("thread.closedBanner.declinedMessage")}
        />
      )}
      {thread.status === "expired" && (
        <Alert
          variant="warning"
          title={tInbox("thread.closedBanner.expiredTitle")}
          message={tInbox("thread.closedBanner.expiredMessage")}
        />
      )}

      <InquiryStatusActions inquiryId={thread.id} status={thread.status} />

      <SellerThreadComposer
        inquiryId={thread.id}
        messages={messages}
        composerPlaceholder={tInbox("thread.composerPlaceholder")}
        sendLabel={tInbox("thread.sendLabel")}
        emptyMessage={tInbox("thread.emptyMessage")}
        sendErrorMessage={tInbox("thread.sendError")}
        readOnly={isReadOnly}
        closedMessage={
          thread.status === "declined"
            ? tInbox("thread.closedBanner.declinedMessage")
            : tInbox("thread.closedBanner.expiredMessage")
        }
      />

      <MarkThreadRead inquiryId={thread.id} hasUnread={thread.unreadCount > 0} />
    </div>
  );
}
