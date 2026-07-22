/**
 * /seller/inbox — Seller Inbox thread list (BETK_UI_SPEC.md L476-484, FR-SEL-13).
 * Phase 06 / T04. Inside the `(seller)` route group (ConsoleSidebar shell via
 * `SellerChrome`); middleware already gates every `/seller*` route — this RSC
 * page does not re-implement that guard.
 *
 * DATA: `getStoreInquiries` (Phase 06 / T02) — own-store scope resolved
 * server-side (`resolveCallerScope`), on top of RLS `inq_buyer` (buyer OR
 * store OR admin). Status filter is URL-driven (`?status=`, the T03-Phase-05
 * `ListingsFilterTabs` pattern); counts via the additive
 * `getStoreInquiriesStatusCounts` (5 lean head-only reads, cheap — the
 * `getOwnListingsStatusCounts` precedent).
 *
 * ORDERING/TIMESTAMP (REG-43, derive-at-read): rows render the query's
 * DERIVED `lastActivityAt` — `inquiries.last_message_at` is never read
 * directly (stale by design, REG-43).
 *
 * BUYER IDENTITY (REG-44, PRIVACY DECISION AUTHORIZED BY THE HUMAN,
 * SUPERSEDES the canonical pack's "buyer display name" line): the buyer's
 * name is NOT rendered — `bp_self` is self-only and buyer identity stays
 * private pre-transaction (resolves at checkout, Phase 07). Each row shows a
 * generic keyed label (`seller.inbox.buyerLabel`, "Buyer"/"مشتري" — the
 * Phase-03/T05 store-reviews `reviews.buyerLabel` precedent), never a
 * pseudonymous handle (that would need a UI_SPEC/OD decision, not invented
 * here). `getStoreInquiries` only ever surfaces `buyerId`, never a name — the
 * value is unused UI-side by design (no service-role reach-around).
 *
 * WHATSAPP / CONTACT (REG-45 symmetry): no deep-link or contact affordance on
 * this row either — the buyer's phone is equally RLS-unreachable under
 * `bp_self` (mirrors REG-45's buyer-side finding). Omitted, not faked.
 *
 * RESPONSE-TIME CHIP (UI_SPEC L481, DECISION 2 = Option A live recompute):
 * rendered ONCE at the page level via `getOwnAvgResponseHours` — see that
 * query's header for why per-row would be redundant (one seller-level value).
 * NULL → the keyed "not enough data" line (never a fabricated 0).
 */

import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getStoreInquiries,
  getStoreInquiriesStatusCounts,
  getOwnAvgResponseHours,
} from "@/features/messaging";
import type { InquirySummary } from "@/features/messaging/types";
import type { InquiryStatusFilter } from "@/validations/messaging";
import { inquiryStatusFilterSchema } from "@/validations/messaging";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/i18n/localizedName";
import { routes } from "@/constants/routes";
import { StatusBadge, EmptyState } from "@/components/shared";
import { catalogSellerResponseLabel } from "@/i18n/catalogLabels";
import { SellerInboxFilterTabs } from "./_components/SellerInboxFilterTabs";

interface RouteParams {
  locale: string;
}

type RawSearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

interface Props {
  params: Promise<RouteParams>;
  searchParams: Promise<RawSearchParams>;
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

function SellerInquiryRow({
  inquiry,
  locale,
  statusLabels,
  listingFallback,
  buyerLabel,
  unreadAria,
}: {
  inquiry: InquirySummary;
  locale: AppLocale;
  statusLabels: Record<string, string>;
  listingFallback: string;
  buyerLabel: string;
  unreadAria: string;
}) {
  const title = inquiry.listing
    ? localizedName({ ar: inquiry.listing.titleAr, en: inquiry.listing.titleEn }, locale)
    : listingFallback;
  const hasUnread = inquiry.unreadCount > 0;

  return (
    <Link
      href={routes.seller.inboxThread(inquiry.id)}
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
        {/* REG-44 (authorized privacy decision): generic label, never the buyer's name. */}
        <span className="truncate text-xs text-muted-foreground">{buyerLabel}</span>
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

export async function generateMetadata() {
  const t = await getTranslations("seller.inbox");
  return { title: `${t("metaTitle")} — BETK` };
}

export default async function SellerInboxPage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);
  const locale = localeParam as AppLocale;

  const sp = await searchParams;
  const parsedStatus = inquiryStatusFilterSchema.safeParse(first(sp.status));
  const status: InquiryStatusFilter = parsedStatus.success ? parsedStatus.data : "all";

  const t = await getTranslations({ locale, namespace: "seller.inbox" });
  const tInbox = await getTranslations({ locale, namespace: "inbox" });
  const catalogT = await getTranslations({ locale, namespace: "catalog" });

  const [inquiries, counts, avgResponseHours] = await Promise.all([
    getStoreInquiries({ status }),
    getStoreInquiriesStatusCounts(),
    getOwnAvgResponseHours(),
  ]);

  const statusLabels: Record<string, string> = {
    open: tInbox("status.open"),
    replied: tInbox("status.replied"),
    confirmed: tInbox("status.confirmed"),
    declined: tInbox("status.declined"),
    expired: tInbox("status.expired"),
  };

  const responseLabel =
    typeof avgResponseHours === "number"
      ? catalogSellerResponseLabel(catalogT, avgResponseHours)
      : t("responseTime.noData");

  return (
    <div className="mx-auto flex w-full max-w-container flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h2 font-bold text-foreground">{t("title")}</h1>
        <span className="text-sm text-muted-foreground">{responseLabel}</span>
      </div>

      <SellerInboxFilterTabs currentStatus={status} counts={counts} />

      {inquiries.length === 0 ? (
        <EmptyState variant={status === "all" ? "default" : "filtered"} message={t("empty.message")} />
      ) : (
        <div className="flex flex-col gap-2">
          {inquiries.map((inquiry) => (
            <SellerInquiryRow
              key={inquiry.id}
              inquiry={inquiry}
              locale={locale}
              statusLabels={statusLabels}
              listingFallback={tInbox("list.listingFallback")}
              buyerLabel={t("buyerLabel")}
              unreadAria={tInbox("list.unreadAria", { count: inquiry.unreadCount })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
