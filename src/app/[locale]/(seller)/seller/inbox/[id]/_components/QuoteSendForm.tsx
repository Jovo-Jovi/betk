"use client";

/**
 * P37 quote send. Composes Input and Button. The band error is inline.
 * `BETK_QUOTE_LINE_HELD` is the catalog sentence that the buyer already
 * holds this quote in their cart. File-path action import.
 */

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendInquiryQuote } from "@/features/messaging/actions/sendInquiryQuote";

export interface QuoteSendFormProps {
  inquiryId: string;
  listingPriceText: string | null;
}

export function QuoteSendForm({ inquiryId, listingPriceText }: QuoteSendFormProps) {
  const t = useTranslations("seller.inbox.thread.quote");
  const tErrors = useTranslations("p10Errors");
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [prep, setPrep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const quotedPrice = Number(price);
    const prepDays = Number(prep);
    if (price.trim() === "" || prep.trim() === "" || !Number.isFinite(quotedPrice) || !Number.isFinite(prepDays)) {
      setError(t("invalid"));
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await sendInquiryQuote({ inquiryId, quotedPrice, prepDays });
      if (res.ok) {
        toast.success(t("success"));
        router.refresh();
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
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      {listingPriceText && <p className="text-sm text-muted-foreground">{listingPriceText}</p>}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-price" className="text-sm font-medium text-foreground">
            {t("priceLabel")}
          </label>
          <Input
            id="quote-price"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            disabled={isPending}
            dir="ltr"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-prep" className="text-sm font-medium text-foreground">
            {t("prepLabel")}
          </label>
          <Input
            id="quote-prep"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={prep}
            onChange={(event) => setPrep(event.target.value)}
            disabled={isPending}
            dir="ltr"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
