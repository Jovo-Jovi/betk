"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * SellerOrderMoney — subtotal, commission, refunded subtotal and net on P25,
 * P38, P39, P41, P42, P43. Net-new (CD-DELTA-6 Wave 3, §2.7). One variant;
 * P41/P43 pass a different `net`.
 * Money is only the four numbers and the four labels (§2.7 f2, W3-3). A
 * refunded subtotal of zero still renders in its own slot.
 * Loading / empty / error never render a figure, so no zero set is invented.
 * One polite live region stays mounted across states; error uses role="alert".
 * MUST-NEVER-RENDER (M1, M3, N28): the props type has no delivery-fee,
 * order-total, buyer-identity, address or city field, not even optional.
 * Token-only. All strings are props (DS-I18N).
 */
export interface SellerOrderMoneyProps {
  /** seller_orders.subtotal */
  subtotal: number;
  /** seller_orders.commission_amount */
  commissionAmount: number;
  /** seller_orders.refunded_subtotal (goods portion; NOT NULL default 0) */
  refundedSubtotal: number;
  /** Page-computed. Not a column. */
  net: number;
  /** sellerMoney.subtotal */
  labelSubtotal: string;
  /** sellerMoney.commission */
  labelCommission: string;
  /** sellerMoney.refundedSubtotal */
  labelRefundedSubtotal: string;
  /** sellerMoney.net */
  labelNet: string;
  /** Currency unit after each amount (same string the app passes PriceBlock). */
  currencyLabel: string;
  /** State: figures not ready. */
  loading?: boolean;
  /** State: the page has no order money. */
  empty?: boolean;
  /** State: the figures failed. */
  error?: boolean;
  /** sellerMoney.loading (additive key proposal) */
  loadingLabel: string;
  /** sellerMoney.empty */
  emptyLabel: string;
  /** sellerMoney.error */
  errorLabel: string;
  className?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);

export function SellerOrderMoney({
  subtotal, commissionAmount, refundedSubtotal, net,
  labelSubtotal, labelCommission, labelRefundedSubtotal, labelNet, currencyLabel,
  loading = false, empty = false, error = false, loadingLabel, emptyLabel, errorLabel, className,
}: SellerOrderMoneyProps) {
  const live = loading ? loadingLabel : !error && empty ? emptyLabel : "";
  const rows: [string, number][] = [
    [labelSubtotal, subtotal],
    [labelCommission, commissionAmount],
    [labelRefundedSubtotal, refundedSubtotal],
  ];

  return (
    <div aria-busy={loading || undefined} className={cn("rounded-lg border border-border bg-card p-4 text-card-foreground", className)}>
      <span role="status" aria-live="polite" className="sr-only">{live}</span>
      {loading ? (
        <div aria-hidden className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className={cn("h-4", i === 3 ? "h-6 w-24" : "w-16")} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center gap-2">
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">{errorLabel}</p>
        </div>
      ) : empty ? (
        <p aria-hidden className="text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <dl tabIndex={0} className="flex flex-col gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="inline-flex shrink-0 items-baseline gap-1">
                <span dir="ltr" className="text-sm font-semibold tabular-nums text-foreground">{fmt(value)}</span>
                <span className="text-xs font-semibold text-foreground">{currencyLabel}</span>
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
            <dt className="font-display text-base font-semibold text-foreground">{labelNet}</dt>
            <dd className="inline-flex shrink-0 items-baseline gap-1">
              <span dir="ltr" className="font-display text-xl font-bold leading-none tabular-nums text-foreground">{fmt(net)}</span>
              <span className="text-sm font-semibold text-foreground">{currencyLabel}</span>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
