"use client";

/**
 * ListingActionButtons — Listing Detail CTA row. Phase 03 / T05 (composition
 * only — Button/WishlistButton are untouched Claude-Design/shadcn primitives).
 *
 * WISHLIST (T06): the heart calls the real `toggleWishlist` Server Action —
 * an authenticated buyer's click adds/removes the row (optimistic flip
 * reconciled to the action's returned `active` state), and a guest is rejected
 * (`reason: "unauthenticated"`) and routed to `/auth/login?returnUrl=…`
 * (locale-preserving). The initial `saved` state is NOT hydrated here on
 * purpose: the detail page stays ISR-cached under the anon client (per-id
 * `revalidate`), and reading per-user wishlist state server-side would force
 * the whole page dynamic and forfeit that cache — NOT "cheap" per the T06
 * prompt. The heart therefore starts unsaved and reconciles to DB truth on the
 * first click (the action reads the caller's own row before toggling, so the
 * persisted result is always correct regardless of the optimistic start).
 *
 * INQUIRY (Phase 06 / T03, now wired to the real flow): `useViewerListingAccess`
 * resolves the viewer's auth + ownership state CLIENT-SIDE (see that hook's
 * header — the page itself stays identity-free/ISR-cached; this never touches
 * the RSC render). Click behavior:
 *   - guest (or session still resolving)   → `/auth/login?returnUrl=` (unchanged)
 *   - authed, viewing their OWN listing    → CTA disabled (no UI_SPEC-pinned
 *     affordance for this edge case — BETK_UI_SPEC.md L107-110 — so we disable
 *     rather than invent one), `title` states the reason.
 *   - authed, non-owner                    → opens `InquiryComposer`
 *     (BETK_UI_SPEC.md L108/110: "InquiryButton → opens inquiry composer" with
 *     quantity/delivery_preference/special_requests fields), which on success
 *     routes to `/inbox/[inquiryId]` (the real thread — ADR-014's `createInquiry`).
 *
 * NOTIFY-ME (`sold_out` CTA swap) remains an ENTRY POINT ONLY — the
 * `restock_alerts` write is a later, unscoped phase (R-N06) — so it still
 * routes straight to `/auth/login?returnUrl=` for guest AND authed alike,
 * unchanged from the T02 placeholder convention.
 *
 * Share is the one exception — sharing a public listing link needs no auth,
 * so it never redirects; it opens a `wa.me` deep-link with the page's own
 * current URL (client-only — `window.location.href` — no server-side
 * SITE_URL env var exists in this repo to build an absolute URL otherwise).
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/shared";
import { toggleWishlist } from "@/features/discovery/actions/toggleWishlist";
import { useViewerListingAccess } from "@/features/discovery/hooks/useViewerListingAccess";
import { InquiryComposer } from "@/features/messaging/components/InquiryComposer";
import { MessageCircle, BellRing, Share2 } from "lucide-react";

export interface ListingActionButtonsProps {
  listingId: string;
  /** The listing's owning store — resolves viewer-ownership client-side. */
  storeId: string;
  /** Text shared alongside the URL in the WhatsApp deep-link. */
  shareText: string;
  isSoldOut: boolean;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
  inquiryLabel: string;
  inquiryOwnListingReason: string;
  notifyMeLabel: string;
  shareLabel: string;
  className?: string;
}

export function ListingActionButtons({
  listingId,
  storeId,
  shareText,
  isSoldOut,
  wishlistAddLabel,
  wishlistRemoveLabel,
  inquiryLabel,
  inquiryOwnListingReason,
  notifyMeLabel,
  shareLabel,
  className,
}: ListingActionButtonsProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const access = useViewerListingAccess(storeId);

  const goToLogin = () => {
    router.push(`${routes.auth.login}?returnUrl=${encodeURIComponent(routes.listing(listingId))}`);
  };

  const handleToggleSave = (next: boolean) => {
    const previous = saved;
    setSaved(next); // optimistic

    startTransition(async () => {
      const result = await toggleWishlist(listingId);
      if (result.ok) {
        setSaved(result.active);
        return;
      }
      setSaved(previous); // revert
      if (result.reason === "unauthenticated") {
        goToLogin();
      }
    });
  };

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const text = `${shareText} ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const isOwnListing = access.status === "authed" && access.isOwnListing;

  const handleInquiryClick = () => {
    if (isSoldOut) {
      // Notify-me stays an entry-point placeholder (R-N06, unscoped this phase).
      goToLogin();
      return;
    }
    if (access.status === "authed") {
      if (access.isOwnListing) return; // disabled — no click handler needed, belt & suspenders
      setComposerOpen(true);
      return;
    }
    // guest OR still resolving the session — unchanged placeholder redirect.
    goToLogin();
  };

  return (
    <div className={className ? className : "flex items-center gap-2.5"}>
      <Button
        type="button"
        className="flex-1"
        onClick={handleInquiryClick}
        disabled={!isSoldOut && isOwnListing}
        title={!isSoldOut && isOwnListing ? inquiryOwnListingReason : undefined}
        aria-disabled={!isSoldOut && isOwnListing}
      >
        {isSoldOut ? <BellRing className="size-4" /> : <MessageCircle className="size-4" />}
        {isSoldOut ? notifyMeLabel : inquiryLabel}
      </Button>
      <WishlistButton
        size="lg"
        active={saved}
        addLabel={wishlistAddLabel}
        removeLabel={wishlistRemoveLabel}
        onToggle={handleToggleSave}
      />
      <Button type="button" variant="outline" size="icon" aria-label={shareLabel} onClick={handleShare}>
        <Share2 className="size-4" />
      </Button>

      {!isSoldOut && (
        <InquiryComposer
          listingId={listingId}
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
      )}
    </div>
  );
}
