"use client";

/**
 * ListingActionButtons — Listing Detail CTA row. Phase 03 / T05 (composition
 * only — Button/WishlistButton are untouched Claude-Design/shadcn primitives).
 *
 * WISHLIST (T06, now wired): the heart calls the real `toggleWishlist` Server
 * Action — an authenticated buyer's click adds/removes the row (optimistic flip
 * reconciled to the action's returned `active` state), and a guest is rejected
 * (`reason: "unauthenticated"`) and routed to `/auth/login?returnUrl=…`
 * (locale-preserving). The initial `saved` state is NOT hydrated here on
 * purpose: the detail page stays ISR-cached under the anon client (per-id
 * `revalidate`), and reading per-user wishlist state server-side would force the
 * whole page dynamic and forfeit that cache — NOT "cheap" per the T06 prompt.
 * The heart therefore starts unsaved and reconciles to DB truth on the first
 * click (the action reads the caller's own row before toggling, so the persisted
 * result is always correct regardless of the optimistic start).
 *
 * INQUIRY / NOTIFY-ME remain ENTRY POINTS ONLY, the placeholder convention T02
 * established: the inquiry composer and the `restock_alerts` write are
 * explicitly later-phase (not scoped to T06), so those buttons still route
 * straight to `/auth/login?returnUrl=` (locale-preserving) for guest AND authed
 * alike, until a future task wires their real Server Actions.
 *
 * Share is the one exception — sharing a public listing link needs no auth,
 * so it never redirects; it opens a `wa.me` deep-link with the page's own
 * current URL (client-only — `window.location.href` — no server-side
 * SITE_URL env var exists in this repo to build an absolute URL otherwise).
 *
 * `isSoldOut` swaps the primary CTA to the R-N06 "notify me" restock button
 * (Wishlist + Share stay); it reuses the SAME login-redirect placeholder.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/shared";
import { toggleWishlist } from "@/features/discovery/actions/toggleWishlist";
import { MessageCircle, BellRing, Share2 } from "lucide-react";

export interface ListingActionButtonsProps {
  listingId: string;
  /** Text shared alongside the URL in the WhatsApp deep-link. */
  shareText: string;
  isSoldOut: boolean;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
  inquiryLabel: string;
  notifyMeLabel: string;
  shareLabel: string;
  className?: string;
}

export function ListingActionButtons({
  listingId,
  shareText,
  isSoldOut,
  wishlistAddLabel,
  wishlistRemoveLabel,
  inquiryLabel,
  notifyMeLabel,
  shareLabel,
  className,
}: ListingActionButtonsProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

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

  return (
    <div className={className ? className : "flex items-center gap-2.5"}>
      <Button type="button" className="flex-1" onClick={goToLogin}>
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
    </div>
  );
}
