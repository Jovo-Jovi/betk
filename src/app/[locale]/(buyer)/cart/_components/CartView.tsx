"use client";

/**
 * P66 cart. Composes CartLine. Goods subtotal plus the R-DELIVERY line.
 * No delivery figure and no grand total.
 */

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CartLine } from "@/components/shared/CartLine";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorRetryCard } from "@/components/shared/ErrorRetryCard";
import { routes } from "@/constants/routes";
import { setCartItemQuantity } from "@/features/discovery/actions/setCartItemQuantity";
import { removeCartItem } from "@/features/cart/actions/removeCartItem";
import { releaseHeldQuoteLine } from "@/features/cart/actions/releaseHeldQuoteLine";
import { CART_UPDATED_EVENT } from "@/features/cart/cartEvents";
import { goodsSubtotal } from "@/features/cart/cartRules";
import type { CartPageLine, DroppedQuotePrompt } from "@/features/cart/types";

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);

function notifyCartUpdated() {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function CartPageError() {
  const t = useTranslations("cart");
  const common = useTranslations("common");
  const router = useRouter();
  return (
    <ErrorRetryCard
      message={t("error")}
      retryLabel={common("retry")}
      onRetry={() => router.refresh()}
    />
  );
}

export function CartView({
  lines,
  dropped,
  currencyLabel,
}: {
  lines: CartPageLine[];
  dropped: DroppedQuotePrompt[];
  currencyLabel: string;
}) {
  const t = useTranslations("cart");
  const line = useTranslations("cartLine");
  const router = useRouter();
  const [rows, setRows] = useState(lines);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);

  useEffect(() => {
    setRows(lines);
  }, [lines]);

  const labels = {
    increaseLabel: line("increase"),
    decreaseLabel: line("decrease"),
    removeLabel: line("remove"),
    blockedQuoteLabel: line("blockedQuote"),
    droppedQuoteLabel: line("droppedQuote"),
    requestNewQuoteLabel: line("requestNewQuote"),
    customLabel: line("custom"),
    errorLabel: line("error"),
  };

  async function onQuantityChange(lineId: string, quantity: number) {
    setPendingId(lineId);
    setErrorId(null);
    const result = await setCartItemQuantity({ cartItemId: lineId, quantity });
    setPendingId(null);
    if (!result.ok) {
      setErrorId(lineId);
      return;
    }
    setRows((current) =>
      current.map((row) => (row.lineId === lineId ? { ...row, quantity } : row)),
    );
    setStatusById((current) => ({ ...current, [lineId]: line("statusQuantity", { count: quantity }) }));
    notifyCartUpdated();
    router.refresh();
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setPendingId(id);
    setErrorId(null);
    const result = await removeCartItem({ cartItemId: id });
    setPendingId(null);
    if (!result.ok) {
      setErrorId(id);
      setRemoveId(null);
      return;
    }
    setRows((current) => current.filter((row) => row.lineId !== id));
    setRemoveId(null);
    notifyCartUpdated();
    router.refresh();
  }

  async function onRequestNewQuote(lineId: string) {
    const held = rows.find((row) => row.lineId === lineId && row.blockedReason === "quote_expired");
    if (!held?.inquiryId) return;
    setPendingId(lineId);
    setErrorId(null);
    const result = await releaseHeldQuoteLine({ cartItemId: lineId });
    if (!result.ok) {
      setPendingId(null);
      setErrorId(lineId);
      return;
    }
    flushSync(() => {
      setRows((current) => current.filter((row) => row.lineId !== lineId));
      setPendingId(null);
    });
    notifyCartUpdated();
    router.push(routes.buyer.inboxThread(result.inquiryId));
  }

  const empty = rows.length === 0 && dropped.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {empty ? (
        <EmptyState
          message={t("empty.message")}
          hint={t("empty.hint")}
          action={{
            label: t("empty.cta"),
            onClick: () => router.push(routes.search),
          }}
        />
      ) : (
        <>
          {rows.map((row) => (
            <CartLine
              key={row.lineId}
              lineId={row.lineId}
              title={row.title}
              unitPrice={row.unitPrice}
              quantity={row.quantity}
              isCustom={row.isCustom}
              stockQty={row.stockQty}
              quoteExpiresAt={row.quoteExpiresAt}
              storeName={row.storeName}
              blockedReason={row.blockedReason}
              droppedAfterRestore={false}
              pending={pendingId === row.lineId}
              error={errorId === row.lineId}
              statusLabel={statusById[row.lineId]}
              currencyLabel={currencyLabel}
              blockedStockLabel={
                row.stockLabel === "unavailable" ? line("blockedUnavailable") : line("blockedStock")
              }
              {...labels}
              onQuantityChange={(id, quantity) => void onQuantityChange(id, quantity)}
              onRemove={(id) => setRemoveId(id)}
              onRequestNewQuote={
                row.blockedReason === "quote_expired" ? (id) => void onRequestNewQuote(id) : undefined
              }
            />
          ))}

          {dropped.map((prompt) => (
            <CartLine
              key={prompt.inquiryId}
              lineId={prompt.inquiryId}
              title={prompt.title}
              unitPrice={prompt.unitPrice}
              quantity={prompt.quantity}
              isCustom
              stockQty={null}
              storeName={prompt.storeName}
              blockedReason={null}
              droppedAfterRestore
              currencyLabel={currencyLabel}
              blockedStockLabel={line("blockedStock")}
              {...labels}
              onRequestNewQuote={() => router.push(routes.buyer.inboxThread(prompt.inquiryId))}
            />
          ))}

          {rows.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span>{t("goodsSubtotal")}</span>
                <span className="inline-flex items-baseline gap-1">
                  <span dir="ltr" className="font-display font-bold tabular-nums">
                    {fmt(goodsSubtotal(rows))}
                  </span>
                  <span>{currencyLabel}</span>
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{t("deliveryCalculated")}</p>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={removeId != null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title={t("removeTitle")}
        message={t("removeMessage")}
        confirmLabel={t("removeConfirm")}
        cancelLabel={t("removeCancel")}
        destructive
        loading={pendingId != null && pendingId === removeId}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
