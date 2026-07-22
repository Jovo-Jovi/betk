/**
 * /inbox — Buyer Inbox thread list (BETK_UI_SPEC.md L219-229, FR-BUY-5).
 * Phase 06 / T03. Protected by the T10 middleware (buyer gate) — this RSC page
 * assumes an authed, active user and does not re-implement that guard.
 *
 * DATA: `getOwnInquiries()` (Phase 06 / T02) — participant-scoped by RLS
 * (`inq_buyer`), pinned to `buyer_id = self`. Imported by its query file path
 * (consistent with `getProfile` in `/account`), not the messaging barrel.
 *
 * ORDERING/TIMESTAMP (REG-43, T02 DECISION 4 — derive-at-read): the query
 * already sorts by the DERIVED `lastActivityAt` (`max(created_at, max message
 * sent_at)`); this page renders that field as-is and never reads
 * `inquiries.last_message_at` directly (stale by design, REG-43).
 *
 * UNREAD (REG-42 CLOSED, T02-FIX): each row's `unreadCount` drives the
 * indicator dot + an sr-only count. Marking read happens on the THREAD page
 * (`/inbox/[id]`, client-side, on mount) — never here, and never from an RSC
 * render path (a Server Action mutation must not run during a GET render).
 *
 * STATUS: `inquiry_status` has five members (open/replied/confirmed/declined/
 * expired) — all five get a label (`inbox.status.*`), no invented member.
 *
 * PAGINATION: `getOwnInquiries` returns the full list unpaged (T02's shape) —
 * per the task instruction, not invented here either.
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOwnInquiries } from "@/features/messaging/queries/getOwnInquiries";
import type { InquirySummary } from "@/features/messaging/types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import { StatusBadge } from "@/components/shared";
import { InboxEmptyState } from "./_components/InboxEmptyState";

interface RouteParams {
  locale: string;
}

function formatActivity(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-EG" : "ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function ListingThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="m3 16 4.5-4.5a2 2 0 0 1 2.8 0L15 16" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-14 shrink-0 rounded-md object-cover" />;
}

function InquiryRow({
  inquiry,
  locale,
  statusLabels,
  listingFallback,
  storeFallback,
  unreadAria,
}: {
  inquiry: InquirySummary;
  locale: AppLocale;
  statusLabels: Record<string, string>;
  listingFallback: string;
  storeFallback: string;
  unreadAria: string;
}) {
  const title = inquiry.listing
    ? localizedName({ ar: inquiry.listing.titleAr, en: inquiry.listing.titleEn }, locale)
    : listingFallback;
  const storeName = inquiry.store
    ? localizedName({ ar: inquiry.store.nameAr, en: inquiry.store.nameEn }, locale)
    : storeFallback;
  const hasUnread = inquiry.unreadCount > 0;

  return (
    <Link
      href={routes.buyer.inboxThread(inquiry.id)}
      data-slot="inquiry-row"
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      <ListingThumb url={inquiry.listing?.heroImageUrl ?? null} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-display text-sm font-bold text-foreground">
            {title}
          </span>
          <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">
            {formatActivity(inquiry.lastActivityAt, locale)}
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">{storeName}</span>
        <div className="flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-sm ${hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {inquiry.lastMessagePreview}
          </span>
          {hasUnread && (
            <span
              role="status"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
            >
              <span className="sr-only">{unreadAria}</span>
              {inquiry.unreadCount > 9 ? "9+" : inquiry.unreadCount}
            </span>
          )}
        </div>
      </div>

      <StatusBadge domain="inquiry" status={inquiry.status} label={statusLabels[inquiry.status]} />
    </Link>
  );
}

export default async function InboxPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const t = await getTranslations({ locale, namespace: "inbox" });
  const inquiries = await getOwnInquiries();

  const statusLabels: Record<string, string> = {
    open: t("status.open"),
    replied: t("status.replied"),
    confirmed: t("status.confirmed"),
    declined: t("status.declined"),
    expired: t("status.expired"),
  };

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-h2 font-bold text-foreground">{t("pageTitle")}</h1>

      {inquiries.length === 0 ? (
        <InboxEmptyState
          message={t("empty.message")}
          hint={t("empty.hint")}
          ctaLabel={t("empty.cta")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {inquiries.map((inquiry) => (
            <InquiryRow
              key={inquiry.id}
              inquiry={inquiry}
              locale={locale}
              statusLabels={statusLabels}
              listingFallback={t("list.listingFallback")}
              storeFallback={t("list.storeFallback")}
              unreadAria={t("list.unreadAria", { count: inquiry.unreadCount })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
