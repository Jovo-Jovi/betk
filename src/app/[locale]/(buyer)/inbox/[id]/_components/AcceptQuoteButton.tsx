"use client";

/**
 * P14 accept. Composes Button. Success goes to `/cart` (P66, T05).
 * No checkout control. File-path action import.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { acceptInquiryQuote } from "@/features/messaging/actions/acceptInquiryQuote";
import { notifyCartUpdated } from "@/features/cart/cartEvents";

export interface AcceptQuoteButtonProps {
  inquiryId: string;
  label: string;
}

export function AcceptQuoteButton({ inquiryId, label }: AcceptQuoteButtonProps) {
  const tErrors = useTranslations("p10Errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showCartLink, setShowCartLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    setError(null);
    setShowCartLink(false);
    startTransition(async () => {
      const res = await acceptInquiryQuote({ inquiryId });
      if (res.ok) {
        notifyCartUpdated();
        router.push(routes.buyer.cart);
        return;
      }
      if (res.reason === "unauthenticated") {
        router.push(routes.auth.login);
        return;
      }
      if (res.reason === "blocked") {
        router.push("/blocked");
        return;
      }
      setError(tErrors(res.messageKey));
      setShowCartLink(res.messageKey === "cartLineExists");
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" onClick={handleAccept} disabled={isPending}>
        {label}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
          {showCartLink && (
            <>
              {" "}
              <Link href={routes.buyer.cart} className="font-medium text-foreground underline">
                {tErrors("viewCart")}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
