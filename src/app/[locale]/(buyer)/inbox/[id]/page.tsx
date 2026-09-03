/**
 * /inbox/[id] — Buyer Inbox thread (BETK_UI_SPEC.md L219-229, FR-BUY-5).
 * Phase 06 / T03. Protected by the T10 middleware (buyer gate).
 *
 * BINDING RULE (T04-Phase-05 / T03-Phase-06 precedent): NO `loading.tsx` on
 * this segment — a route-level Suspense boundary would stream a 200 shell
 * before `notFound()` can commit its real 404 status. The `notFound()`
 * decision below runs synchronously, no Suspense between the route and it.
 *
 * OUTSIDER / UNKNOWN / MALFORMED id → hard 404: `getInquiryThread` (T02)
 * returns `null` for all three cases (RLS default-deny IS the 404 — an
 * outsider's read returns zero rows, indistinguishable from "doesn't exist",
 * no existence leak; a malformed uuid surfaces as `22P02`, also mapped to
 * null). This page's ONLY job on a null read is `notFound()`.
 *
 * MESSAGES: `thread.messages` already carries the merged opening bubble as
 * its first entry (the T03 query-layer merge, see `getInquiryThread`'s header)
 * — `MessageThread` is composed AS-IS against it, no splicing here.
 *
 * MARK-READ: `MarkThreadRead` (client, mount-effect) calls `markInquiryRead`
 * — never from this RSC render path.
 *
 * CONFIRMED CTA: Phase 07 / T03 wires the real `routes.checkout(thread.id)`
 * link here (closing the dead-link-rule forward reference this comment used
 * to describe). Already-converted (`convertedToOrderId` set) routes straight
 * to the existing order's confirmation page instead — idempotent, never
 * re-runs checkout on a re-visit.
 *
 * WHATSAPP DEEP-LINK (REG-45, flagged, NOT built): BETK_UI_SPEC.md L224 pins
 * a "WhatsApp deep-link button" on this page, but the counterpart's phone
 * number is RLS-unreachable from here — `betk.users_self` is a self/admin-only
 * SELECT (no public/thread-party branch), and `stores` carries no
 * whatsapp/phone column at all (`BETK_DATABASE_SCHEMA.sql` L226-250). Same
 * "specced-but-absent" class as REG-44 (buyer name unreachable to the
 * seller) — flagged, not worked around with a service-role reach-around.
 */

import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getInquiryThread } from "@/features/messaging/queries/getInquiryThread";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import { Alert, StatusBadge, type ThreadMessage } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { MarkThreadRead } from "./_components/MarkThreadRead";
import { ThreadComposer } from "./_components/ThreadComposer";

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

export default async function InboxThreadPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, id } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const thread = await getInquiryThread(id);
  if (!thread) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "inbox" });
  const tDelivery = await getTranslations({ locale, namespace: "store.about.delivery.modes" });

  const statusLabels: Record<string, string> = {
    open: t("status.open"),
    replied: t("status.replied"),
    confirmed: t("status.confirmed"),
    declined: t("status.declined"),
    expired: t("status.expired"),
  };

  const listingTitle = thread.listing
    ? localizedName({ ar: thread.listing.titleAr, en: thread.listing.titleEn }, locale)
    : t("list.listingFallback");

  const isReadOnly = thread.status === "declined" || thread.status === "expired";

  const messages: ThreadMessage[] = thread.messages.map((m) => ({
    id: m.id,
    text: m.body,
    time: formatTime(m.sentAt, locale),
    sent: m.senderType === "buyer",
  }));

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-4 px-4 py-6">
      <Link href={routes.buyer.inbox} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; {t("backToList")}
      </Link>

      {/* Listing context header (BETK_UI_SPEC.md L224 "listing context header"). */}
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
        <StatusBadge domain="inquiry" status={thread.status} label={statusLabels[thread.status]} />
      </div>

      {/* Composer extras (ADR-014 columns: quantity/delivery_preference/special_requests). */}
      {(thread.quantity !== null || thread.deliveryPreference !== null || thread.specialRequests) && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-3 text-sm">
          {thread.quantity !== null && (
            <span>
              <span className="text-muted-foreground">{t("thread.quantityLabel")}: </span>
              <span className="font-semibold text-foreground">{thread.quantity}</span>
            </span>
          )}
          {thread.deliveryPreference !== null && (
            <span>
              <span className="text-muted-foreground">{t("thread.deliveryLabel")}: </span>
              <span className="font-semibold text-foreground">{tDelivery(thread.deliveryPreference)}</span>
            </span>
          )}
          {thread.specialRequests && (
            <span>
              <span className="text-muted-foreground">{t("thread.specialRequestsLabel")}: </span>
              <span className="font-semibold text-foreground">{thread.specialRequests}</span>
            </span>
          )}
        </div>
      )}

      {/* CONFIRMED-STATE CTA — real routes.checkout link (Phase 07 / T03). */}
      {thread.status === "confirmed" && (
        <Alert variant="success" title={t("thread.confirmedBanner.title")}>
          <p>{t("thread.confirmedBanner.message")}</p>
          <Button asChild size="sm" className="mt-2">
            {thread.convertedToOrderId ? (
              <Link href={routes.buyer.checkoutConfirmation(thread.convertedToOrderId)}>
                {t("thread.confirmedBanner.viewOrderCta")}
              </Link>
            ) : (
              <Link href={routes.checkout(thread.id) as Route}>{t("thread.confirmedBanner.cta")}</Link>
            )}
          </Button>
        </Alert>
      )}

      {/* Declined/expired — read-only per BETK_UI_SPEC.md L226. */}
      {thread.status === "declined" && (
        <Alert
          variant="destructive"
          title={t("thread.closedBanner.declinedTitle")}
          message={t("thread.closedBanner.declinedMessage")}
        />
      )}
      {thread.status === "expired" && (
        <Alert
          variant="warning"
          title={t("thread.closedBanner.expiredTitle")}
          message={t("thread.closedBanner.expiredMessage")}
        />
      )}

      <ThreadComposer
        inquiryId={thread.id}
        messages={messages}
        composerPlaceholder={t("thread.composerPlaceholder")}
        sendLabel={t("thread.sendLabel")}
        emptyMessage={t("thread.emptyMessage")}
        sendErrorMessage={t("thread.sendError")}
        readOnly={isReadOnly}
        closedMessage={
          thread.status === "declined"
            ? t("thread.closedBanner.declinedMessage")
            : t("thread.closedBanner.expiredMessage")
        }
      />

      <MarkThreadRead inquiryId={thread.id} hasUnread={thread.unreadCount > 0} />
    </div>
  );
}
