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
 * Share is ShareButton. The page passes an absolute public href
 * (site origin from configuration + the listing route). This component does
 * not read the request and does not open a channel URL.
 *
 * ADD TO CART / REQUEST PRICE (P10 T04, D2): the page passes
 * `purchaseControl`. Add and Request price never render together. A guest
 * add inserts nothing and this component sends them to login. A signed-in
 * add calls `add_fixed_cart_item`. `cartLineExists` shows the catalog
 * message and a link to `/cart`; the quantity is not changed.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { ShareButton, WishlistButton } from "@/components/shared";
import { toggleWishlist } from "@/features/discovery/actions/toggleWishlist";
import { addToCart } from "@/features/discovery/actions/addToCart";
import type { ListingPurchaseControl } from "@/features/discovery/listingPurchaseControl";
import { useViewerListingAccess } from "@/features/discovery/hooks/useViewerListingAccess";
import { InquiryComposer } from "@/features/messaging/components/InquiryComposer";
import { MessageCircle, BellRing } from "lucide-react";

export interface ListingActionButtonsProps {
  listingId: string;
  /** The listing's owning store — resolves viewer-ownership client-side. */
  storeId: string;
  /** Absolute public listing URL. Absent → ShareButton renders nothing. */
  shareHref?: string;
  shareTitle: string;
  isSoldOut: boolean;
  purchaseControl: ListingPurchaseControl;
  wishlistAddLabel: string;
  wishlistRemoveLabel: string;
  inquiryLabel: string;
  inquiryOwnListingReason: string;
  notifyMeLabel: string;
  addToCartLabel: string;
  shareActionLabel: string;
  shareFallbackLabel: string;
  shareCopiedLabel: string;
  shareErrorLabel: string;
  className?: string;
}

export function ListingActionButtons({
  listingId,
  storeId,
  shareHref,
  shareTitle,
  isSoldOut,
  purchaseControl,
  wishlistAddLabel,
  wishlistRemoveLabel,
  inquiryLabel,
  inquiryOwnListingReason,
  notifyMeLabel,
  addToCartLabel,
  shareActionLabel,
  shareFallbackLabel,
  shareCopiedLabel,
  shareErrorLabel,
  className,
}: ListingActionButtonsProps) {
  const router = useRouter();
  const tErrors = useTranslations("p10Errors");
  const [saved, setSaved] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [cartTone, setCartTone] = useState<"ok" | "error">("error");
  const [cartAlreadyHeld, setCartAlreadyHeld] = useState(false);
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

  const handleAddToCart = () => {
    setCartMessage(null);
    setCartAlreadyHeld(false);
    startTransition(async () => {
      const result = await addToCart(listingId);
      if (result.ok) {
        setCartTone("ok");
        setCartMessage(tErrors("cartAdded"));
        return;
      }
      if (result.reason === "unauthenticated") {
        goToLogin();
        return;
      }
      if (result.reason === "blocked") {
        router.push("/blocked");
        return;
      }
      setCartTone("error");
      setCartMessage(tErrors(result.messageKey));
      setCartAlreadyHeld(result.messageKey === "cartLineExists");
    });
  };

  const isOwnListing = access.status === "authed" && access.isOwnListing;

  const handleNotifyClick = () => {
    // Notify-me stays an entry-point placeholder (R-N06, unscoped this phase).
    goToLogin();
  };

  const handleRequestClick = () => {
    if (access.status === "authed") {
      if (access.isOwnListing) return;
      setComposerOpen(true);
      return;
    }
    goToLogin();
  };

  const showRequest = purchaseControl === "request";
  const showAdd = purchaseControl === "add";

  return (
    <div className={className ? className : "flex flex-col gap-2"}>
      <div className="flex items-center gap-2.5">
        {isSoldOut && (
          <Button type="button" className="flex-1" onClick={handleNotifyClick}>
            <BellRing className="size-4" />
            {notifyMeLabel}
          </Button>
        )}
        {showRequest && (
          <Button
            type="button"
            className={isSoldOut ? undefined : "flex-1"}
            variant={isSoldOut ? "outline" : "default"}
            onClick={handleRequestClick}
            disabled={isOwnListing}
            title={isOwnListing ? inquiryOwnListingReason : undefined}
            aria-disabled={isOwnListing}
          >
            <MessageCircle className="size-4" />
            {inquiryLabel}
          </Button>
        )}
        {showAdd && (
          <Button
            type="button"
            className={isSoldOut ? undefined : "flex-1"}
            variant={isSoldOut ? "outline" : "default"}
            onClick={handleAddToCart}
          >
            {addToCartLabel}
          </Button>
        )}
        <WishlistButton
          size="lg"
          active={saved}
          addLabel={wishlistAddLabel}
          removeLabel={wishlistRemoveLabel}
          onToggle={handleToggleSave}
        />
        <ShareButton
          href={shareHref}
          shareTitle={shareTitle}
          actionLabel={shareActionLabel}
          fallbackLabel={shareFallbackLabel}
          copiedLabel={shareCopiedLabel}
          errorLabel={shareErrorLabel}
        />
      </div>
      {cartMessage && (
        <p
          className={cartTone === "error" ? "text-sm text-destructive" : "text-sm text-foreground"}
          role="alert"
        >
          {cartMessage}
          {cartAlreadyHeld && (
            <>
              {" "}
              <Link href={routes.buyer.cart} className="font-medium text-foreground underline">
                {tErrors("viewCart")}
              </Link>
            </>
          )}
        </p>
      )}

      {showRequest && (
        <InquiryComposer
          listingId={listingId}
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
      )}
    </div>
  );
}
