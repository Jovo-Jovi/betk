"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * CheckoutSellerSections — P15 lines grouped under each seller, then ONE
 * combined delivery figure and ONE order total outside every section.
 * Net-new (CD-DELTA-6 Wave 2, §2.6). One variant: N sellers = N sections.
 * Read-only: no callbacks; place-order, the 50% deposit, the address and the
 * phone gate stay on the page (ADR-022, W2-2, W2-3).
 * Loading / empty / error never show `combinedDelivery` or `orderTotal`, so no
 * skeleton, invented or zero figure is ever presented as a real total.
 * MUST-NEVER-RENDER: the props type has no per-seller fee, commission, deposit,
 * buyer-name, buyer-location, phone or agreement field (§2.6 f10, M3).
 * Token-only. All strings are props (DS-I18N).
 */
export interface CheckoutSellerSectionLine {
  /** listings.title_ar / title_en — page picks the locale column. */
  title: string;
  /** cart_items.quantity */
  quantity: number;
  /** cart_items.unit_price */
  unitPrice: number;
}

export interface CheckoutSellerSection {
  /** stores.name_ar / name_en — names the group. */
  storeName: string;
  lines: CheckoutSellerSectionLine[];
}

export interface CheckoutSellerSectionsProps {
  sections: CheckoutSellerSection[];
  /** REG-91 projection, page-computed. One figure for the whole order. */
  combinedDelivery: number;
  /** One order total, page-computed. Not per seller. */
  orderTotal: number;
  /** Sections not ready: skeleton, no figures. */
  loading?: boolean;
  /** Projection failed: `errorLabel`, no figures. */
  error?: boolean;
  /** Currency unit after each amount (catalog's existing currency string). */
  currencyLabel: string;
  /** checkoutSections.delivery */
  deliveryLabel: string;
  /** checkoutSections.total */
  totalLabel: string;
  /** checkoutSections.empty */
  emptyLabel: string;
  /** checkoutSections.error */
  errorLabel: string;
  /** checkoutSections.loading (additive key proposal) — announced while loading. */
  loadingLabel: string;
  className?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);

function Amount({ value, unit, strong }: { value: number; unit: string; strong?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <span dir="ltr" className={cn("font-display font-bold leading-none tabular-nums", strong ? "text-xl text-primary" : "text-sm text-foreground")}>{fmt(value)}</span>
      <span className={cn("font-semibold", strong ? "text-sm text-foreground" : "text-xs text-foreground")}>{unit}</span>
    </span>
  );
}

export function CheckoutSellerSections({
  sections, combinedDelivery, orderTotal, loading = false, error = false,
  currencyLabel, deliveryLabel, totalLabel, emptyLabel, errorLabel, loadingLabel, className,
}: CheckoutSellerSectionsProps) {
  const frame = "rounded-lg border border-border bg-card p-4 text-card-foreground";
  const empty = !loading && !error && sections.length === 0;
  // One polite live region stays mounted across every state; only its text changes.
  const live = loading ? loadingLabel : empty ? emptyLabel : "";

  return (
    <div aria-busy={loading || undefined} className={cn("flex flex-col gap-4", className)}>
      <span role="status" aria-live="polite" className="sr-only">{live}</span>
      {loading ? (
        [0, 1].map((i) => (
          <div key={i} className={cn(frame, "flex flex-col gap-3")} aria-hidden>
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))
      ) : error ? (
        <div role="alert" className={cn(frame, "flex items-center gap-2")}>
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">{errorLabel}</p>
        </div>
      ) : empty ? (
        <div className={cn(frame, "border-dashed")}>
          <p aria-hidden className="text-center text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <>
          {sections.map((s, si) => (
            <div
              key={si}
              role="group"
              aria-label={s.storeName}
              tabIndex={0}
              className={cn(frame, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background")}
            >
              <p className="font-display text-base font-semibold text-foreground">{s.storeName}</p>
              <ul className="mt-2 divide-y divide-border">
                {s.lines.map((l, li) => (
                  <li key={li} className="flex items-start justify-between gap-4 py-2.5">
                    <span className="min-w-0 text-sm leading-relaxed text-foreground">{l.title}</span>
                    <span className="inline-flex shrink-0 items-baseline gap-3">
                      <span dir="ltr" className="text-sm tabular-nums text-muted-foreground">×{fmt(l.quantity)}</span>
                      <Amount value={l.unitPrice} unit={currencyLabel} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <dl className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{deliveryLabel}</dt>
              <dd><Amount value={combinedDelivery} unit={currencyLabel} /></dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <dt className="font-display text-base font-semibold text-foreground">{totalLabel}</dt>
              <dd><Amount value={orderTotal} unit={currencyLabel} strong /></dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}
