"use client";

/**
 * InquiryComposer — Listing Detail's inline inquiry composer (Phase 06 / T03,
 * FR-BUY-5). BETK_UI_SPEC.md L108/L110 pins the flow: "InquiryButton → opens
 * inquiry composer" with fields "quantity, delivery_preference,
 * special_requests" ("Happy — view → tap Inquire → composer (…) → submit
 * (requires auth)"). Composes `ui/dialog` + `ui/input` + `ui/textarea` +
 * `ui/select` + `shared/Alert` (untouched primitives) — no new styled
 * component, so no Claude-Design hand-off needed.
 *
 * Only rendered for an AUTHENTICATED, non-owner viewer (gated by the caller,
 * `ListingActionButtons`, via `useViewerListingAccess` — guests never see this
 * dialog; they keep the `/auth/login?returnUrl=` redirect). The `unauthenticated`
 * branch below is defence-in-depth (a session can expire between mount and
 * submit), not the primary guest path.
 *
 * `createInquiry` is imported by FILE PATH, never the feature barrel (the
 * barrel also re-exports `next/headers`-backed queries — the T03/T04-Phase-05
 * precedent).
 *
 * On success: closes + routes to `/inbox/[inquiryId]` (the buyer's real
 * thread) — the "real flow" entry point T03 wires in place of the previous
 * unconditional login-redirect placeholder.
 */

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert } from "@/components/shared";
// File-path import (NOT the feature barrel) — see header note.
import { createInquiry } from "@/features/messaging/actions/createInquiry";
import type { DeliveryPreference } from "@/validations/messaging";

export interface InquiryComposerProps {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DELIVERY_OPTIONS: DeliveryPreference[] = ["delivery", "pickup", "remote"];

export function InquiryComposer({ listingId, open, onOpenChange }: InquiryComposerProps) {
  const t = useTranslations("listing.composer");
  const tDelivery = useTranslations("store.about.delivery.modes");
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [delivery, setDelivery] = useState<DeliveryPreference | "">("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setMessage("");
    setQuantity("");
    setDelivery("");
    setSpecialRequests("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next && !isPending) reset();
    onOpenChange(next);
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError(t("errorRequired"));
      return;
    }
    setError(null);

    const trimmedQuantity = quantity.trim();
    const quantityNum = trimmedQuantity === "" ? undefined : Number(trimmedQuantity);
    const trimmedSpecialRequests = specialRequests.trim();

    startTransition(async () => {
      const res = await createInquiry({
        listingId,
        message: trimmedMessage,
        quantity: quantityNum,
        deliveryPreference: delivery === "" ? undefined : delivery,
        specialRequests: trimmedSpecialRequests === "" ? undefined : trimmedSpecialRequests,
      });

      if (res.ok) {
        reset();
        onOpenChange(false);
        router.push(routes.buyer.inboxThread(res.inquiryId));
        return;
      }

      if (res.reason === "unauthenticated") {
        router.push(
          `${routes.auth.login}?returnUrl=${encodeURIComponent(routes.listing(listingId))}`,
        );
        return;
      }
      if (res.reason === "listing_unavailable") {
        setError(t("errorUnavailable"));
        return;
      }
      setError(t("errorGeneric"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-display">{t("title")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="destructive" message={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="inquiry-message" className="text-sm font-medium text-foreground">
              {t("messageLabel")}
            </label>
            <Textarea
              id="inquiry-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              rows={4}
              maxLength={2000}
              disabled={isPending}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inquiry-quantity" className="text-sm font-medium text-foreground">
                {t("quantityLabel")}
              </label>
              <Input
                id="inquiry-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={32767}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inquiry-delivery" className="text-sm font-medium text-foreground">
                {t("deliveryLabel")}
              </label>
              <Select
                value={delivery}
                onValueChange={(v) => setDelivery(v as DeliveryPreference)}
                disabled={isPending}
              >
                <SelectTrigger id="inquiry-delivery">
                  <SelectValue placeholder={t("deliveryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {tDelivery(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="inquiry-special-requests" className="text-sm font-medium text-foreground">
              {t("specialRequestsLabel")}
            </label>
            <Textarea
              id="inquiry-special-requests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder={t("specialRequestsPlaceholder")}
              rows={2}
              maxLength={2000}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
