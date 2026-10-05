"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * ChartSeries — seller snapshot series on P46. Net-new (CD-DELTA-6 Wave 3,
 * §2.10). One block. No chart library (§8e): small multiples drawn with
 * token-coloured bars, one panel per measure, each named by its text label.
 * A readout always shows every value of the selected point (default: last),
 * so no value depends on hover. Points are a roving-tabindex strip of date
 * buttons, dir="ltr" like the bars (oldest left; ArrowRight later,
 * ArrowLeft earlier, Home, End, in both locales); each is named by the page's
 * `pointLabel(point, index)`; selection emits `onPointFocus(index)`.
 * `viewsDuringBoost` is charted only for points the page supplies; no date is
 * invented. An empty array is the empty state, never a zero series.
 * MUST-NEVER-RENDER: no total_amount, delivery_fee, buyer-name or
 * buyer-location field. Token-only. All strings are props (DS-I18N).
 */
export interface ChartSeriesPoint {
  /** seller_snapshots.snapshot_date — rendered as given. */
  snapshotDate: string;
  /** seller_snapshots.profile_views */
  profileViews: number;
  /** seller_snapshots.listing_views */
  listingViews: number;
  /** seller_snapshots.inquiries_received */
  inquiriesReceived: number;
  /** seller_snapshots.orders_confirmed */
  ordersConfirmed: number;
  /** seller_snapshots.revenue_egp (subtotal-based) */
  revenueEgp: number;
  /** boosts.views_during_boost — only where the page can align it. */
  viewsDuringBoost?: number;
}

type Measure = "profileViews" | "listingViews" | "inquiriesReceived" | "ordersConfirmed" | "revenueEgp" | "viewsDuringBoost";

export interface ChartSeriesProps {
  points: ChartSeriesPoint[];
  /** Series name (region label). Additive key proposal: chart.title. */
  seriesLabel: string;
  /** State: series not ready. */
  loading?: boolean;
  /** State: series failed. */
  error?: boolean;
  /** Currency unit after revenue (same string the app passes PriceBlock). */
  currencyLabel: string;
  /** chart.profileViews */
  profileViewsLabel: string;
  /** chart.listingViews */
  listingViewsLabel: string;
  /** chart.inquiries */
  inquiriesLabel: string;
  /** chart.ordersConfirmed */
  ordersConfirmedLabel: string;
  /** chart.revenue */
  revenueLabel: string;
  /** chart.boostViews */
  boostViewsLabel: string;
  /** chart.empty */
  emptyLabel: string;
  /** chart.loading */
  loadingLabel: string;
  /** chart.error */
  errorLabel: string;
  /** chart.pointLabel — page-composed accessible name of one point. */
  pointLabel: (point: ChartSeriesPoint, index: number) => string;
  onPointFocus?: (index: number) => void;
  className?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);
const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function ChartSeries({
  points, seriesLabel, loading = false, error = false, currencyLabel,
  profileViewsLabel, listingViewsLabel, inquiriesLabel, ordersConfirmedLabel, revenueLabel, boostViewsLabel,
  emptyLabel, loadingLabel, errorLabel, pointLabel, onPointFocus, className,
}: ChartSeriesProps) {
  const n = points.length;
  const [sel, setSel] = React.useState(Math.max(0, n - 1));
  const stripRef = React.useRef<HTMLDivElement>(null);
  const cur = Math.min(sel, Math.max(0, n - 1));
  React.useEffect(() => { setSel(Math.max(0, n - 1)); }, [n]);
  // Keep the selected date button fully visible: scroll the strip only (never the page).
  React.useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[data-point="${cur}"]`);
    if (!strip || !btn) return;
    const s = strip.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    if (b.left < s.left) strip.scrollLeft -= s.left - b.left;
    else if (b.right > s.right) strip.scrollLeft += b.right - s.right;
  }, [cur, n, loading, error]);

  const hasBoost = points.some((p) => typeof p.viewsDuringBoost === "number");
  const measures: { key: Measure; label: string; money?: boolean }[] = [
    { key: "profileViews", label: profileViewsLabel },
    { key: "listingViews", label: listingViewsLabel },
    { key: "inquiriesReceived", label: inquiriesLabel },
    { key: "ordersConfirmed", label: ordersConfirmedLabel },
    { key: "revenueEgp", label: revenueLabel, money: true },
    ...(hasBoost ? [{ key: "viewsDuringBoost" as Measure, label: boostViewsLabel }] : []),
  ];

  const choose = (i: number, focus: boolean) => {
    const j = Math.max(0, Math.min(n - 1, i));
    setSel(j);
    onPointFocus?.(j);
    if (focus) stripRef.current?.querySelector<HTMLElement>(`[data-point="${j}"]`)?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    // Strip is dir="ltr" like the bars: ArrowRight = later, ArrowLeft = earlier, both locales.
    const map: Record<string, number> = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: n - 1 };
    const target = map[e.key];
    if (target === undefined) return;
    e.preventDefault();
    choose(target, true);
  };

  const live = loading ? loadingLabel : !error && n === 0 ? emptyLabel : "";
  const frame = "rounded-lg border border-border bg-card p-4 text-card-foreground";
  const p = points[cur];
  const value = (pt: ChartSeriesPoint, k: Measure): number | undefined => pt[k];

  return (
    <section aria-label={seriesLabel} aria-busy={loading || undefined} className={cn("flex flex-col gap-4", className)}>
      <span role="status" aria-live="polite" className="sr-only">{live}</span>
      {loading ? (
        <div aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(frame, "flex flex-col gap-3")}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className={cn(frame, "flex items-center gap-2")}>
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-medium text-destructive">{errorLabel}</p>
        </div>
      ) : n === 0 ? (
        <div className={cn(frame, "border-dashed")}>
          <p aria-hidden className="text-center text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {measures.map((m) => {
              const max = Math.max(1, ...points.map((pt) => value(pt, m.key) ?? 0));
              const v = p === undefined ? undefined : value(p, m.key);
              return (
                <div key={m.key} className={cn(frame, "flex flex-col gap-2")}>
                  <dt className="text-sm text-muted-foreground">{m.label}</dt>
                  <dd className="flex flex-col gap-3">
                    <span className="inline-flex min-h-7 items-baseline gap-1">
                      {typeof v === "number" && (
                        <>
                          <span dir="ltr" className="font-display text-2xl font-bold leading-none tabular-nums text-foreground">{fmt(v)}</span>
                          {m.money && <span className="text-sm font-semibold text-foreground">{currencyLabel}</span>}
                        </>
                      )}
                    </span>
                    <span aria-hidden dir="ltr" className="flex h-16 items-end gap-0.5 border-b border-border">
                      {points.map((pt, i) => {
                        const x = value(pt, m.key);
                        return (
                          <span
                            key={i}
                            onClick={() => choose(i, false)}
                            className={cn("min-w-0 flex-1 rounded-t-sm", typeof x !== "number" ? "" : i === cur ? "bg-primary" : "bg-primary/35")}
                            style={{ height: typeof x === "number" ? `${Math.max(4, (x / max) * 100)}%` : 0 }}
                          />
                        );
                      })}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
          <div ref={stripRef} role="toolbar" dir="ltr" aria-label={seriesLabel} onKeyDown={onKey} className="flex gap-2 overflow-x-auto pb-1">
            {points.map((pt, i) => (
              <button
                key={i}
                type="button"
                data-point={i}
                tabIndex={i === cur ? 0 : -1}
                aria-pressed={i === cur}
                aria-label={pointLabel(pt, i)}
                onClick={() => choose(i, false)}
                className={cn("h-11 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm font-semibold tabular-nums", RING, i === cur ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")}
              >
                <span dir="ltr">{pt.snapshotDate}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
