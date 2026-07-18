"use client";

/**
 * ListingActionButtons — Listing Detail CTA row. Phase 03 / T05 (composition
 * only — Button/WishlistButton are untouched Claude-Design/shadcn primitives).
 *
 * ENTRY POINTS ONLY, same placeholder convention T02 established for
 * `ListingCardLink`'s WishlistButton ("every click — guest or authed — goes
 * to login for now"): the real mutations (`toggleWishlist`, an inquiry
 * composer, a `restock_alerts` write) are none of them wired by this task —
 * `toggleWishlist` is T06; the inquiry composer and `restock_alerts` write
 * are explicitly later-phase per the T05 prompt ("composer is a later
 * phase"), not even scoped to T06. So every button here routes straight to
 * `/auth/login?returnUrl=` (locale-preserving) on click, for guest AND authed
 * alike, until a future task wires the real auth-check + Server Action.
 *
 * Share is the one exception — sharing a public listing link needs no auth,
 * so it never redirects; it opens a `wa.me` deep-link with the page's own
 * current URL (client-only — `window.location.href` — no server-side
 * SITE_URL env var exists in this repo to build an absolute URL otherwise).
 *
 * `isSoldOut` swaps the primary CTA to the R-N06 "notify me" restock button
 * (Wishlist + Share stay); it reuses the SAME login-redirect placeholder.
 */

import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/shared";
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

  const goToLogin = () => {
    router.push(`${routes.auth.login}?returnUrl=${encodeURIComponent(routes.listing(listingId))}`);
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
        addLabel={wishlistAddLabel}
        removeLabel={wishlistRemoveLabel}
        onToggle={goToLogin}
      />
      <Button type="button" variant="outline" size="icon" aria-label={shareLabel} onClick={handleShare}>
        <Share2 className="size-4" />
      </Button>
    </div>
  );
}
