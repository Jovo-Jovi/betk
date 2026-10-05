"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * RateMatrixEditor — origin, destination, weight band and fee rows on the
 * P63 Rates tab (admin). Net-new (CD-DELTA-6 Wave 3, §2.8). One variant.
 * Controlled: rows come from the page; every edit emits the whole edited row
 * via `onChange(index, row)`; remove emits `onRemove(index)`; add emits
 * `onAdd()`. The component never writes the database.
 * `feeEgp` is the courier_rates cell only — not an order fee or total.
 * `weightMaxG: null` is the open upper band, shown with `openEndedLabel`.
 * Governorates come only from `governorateOptions`; none are hardcoded.
 * Saving rows (`pendingRows`) are inert via aria-disabled / readOnly and
 * handlers that check the flag. Row errors (`errorRows`) show `errorLabel`
 * on that row with role="alert". Focus moves to the new row on add and to the
 * same-index row (else the previous row, else add) on remove.
 * Native <select>/<input> styled with tokens: no new ui base (W3-2).
 * Rows reflow (2 columns below lg) so every field stays visible at 360px;
 * the region still scrolls on the inline axis if a page narrows it further.
 * MUST-NEVER-RENDER (M3): no buyer-name, buyer-location, identity, address,
 * city or order-total field. Token-only. All strings are props (DS-I18N).
 */
export interface RateRow {
  /** courier_rates.id — absent on an unsaved row. */
  id?: string;
  /** courier_rates.origin_governorate */
  originGovernorate: string;
  /** courier_rates.destination_governorate */
  destinationGovernorate: string;
  /** courier_rates.weight_min_g */
  weightMinG: number;
  /** courier_rates.weight_max_g — null is the open upper band. */
  weightMaxG: number | null;
  /** courier_rates.fee_egp — the rate cell. */
  feeEgp: number;
}

export interface GovernorateOption { value: string; label: string }

export interface RateMatrixEditorProps {
  rows: RateRow[];
  /** Page-supplied; no governorate table in the 51. */
  governorateOptions: GovernorateOption[];
  /** State: rows not ready. */
  loading?: boolean;
  /** State: indexes of rows whose save is in progress. */
  pendingRows?: number[];
  /** State: indexes of rows that are invalid or failed to save. */
  errorRows?: number[];
  /** Page-composed result announcement (polite live region). */
  statusLabel?: string;
  /** Currency unit after the fee field (same string the app passes PriceBlock). */
  currencyLabel: string;
  /** Unit after the weight fields (e.g. grams), page-supplied. */
  weightUnitLabel: string;
  /** rateMatrix.origin */
  originLabel: string;
  /** rateMatrix.destination */
  destinationLabel: string;
  /** rateMatrix.weightMin */
  weightMinLabel: string;
  /** rateMatrix.weightMax */
  weightMaxLabel: string;
  /** rateMatrix.fee */
  feeLabel: string;
  /** rateMatrix.openEnded */
  openEndedLabel: string;
  /** rateMatrix.add */
  addLabel: string;
  /** rateMatrix.remove */
  removeLabel: string;
  /** rateMatrix.empty */
  emptyLabel: string;
  /** rateMatrix.error */
  errorLabel: string;
  /** rateMatrix.loading (additive key proposal) */
  loadingLabel: string;
  onChange?: (index: number, row: RateRow) => void;
  onRemove?: (index: number) => void;
  /** Additive callback: the empty state requires an add action (§2.8 f3). */
  onAdd?: () => void;
  className?: string;
}

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const FIELD = cn("h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60", RING);
const INT = /^\d+$/;

function NumberField({ id, value, inert, unit, onCommit }: { id: string; value: number; inert: boolean; unit: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);
  const shown = focused ? draft : String(value);
  return (
    <span className="flex items-center gap-2">
      <input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        readOnly={inert}
        aria-disabled={inert || undefined}
        onFocus={() => { setDraft(String(value)); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          if (inert) return;
          const v = e.target.value.trim();
          setDraft(v);
          if (INT.test(v)) onCommit(Number(v));
        }}
        className={cn(FIELD, "min-w-0 tabular-nums")}
      />
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{unit}</span>
    </span>
  );
}

export function RateMatrixEditor({
  rows, governorateOptions, loading = false, pendingRows = [], errorRows = [], statusLabel,
  currencyLabel, weightUnitLabel, originLabel, destinationLabel, weightMinLabel, weightMaxLabel, feeLabel,
  openEndedLabel, addLabel, removeLabel, emptyLabel, errorLabel, loadingLabel,
  onChange, onRemove, onAdd, className,
}: RateMatrixEditorProps) {
  const uid = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const addRef = React.useRef<HTMLButtonElement>(null);
  const prevLen = React.useRef(rows.length);
  const removedAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    const root = rootRef.current;
    const prev = prevLen.current;
    prevLen.current = rows.length;
    if (!root || loading) return;
    const rowEl = (i: number) => root.querySelector<HTMLElement>(`[data-rate-row="${i}"]`);
    if (rows.length > prev) {
      rowEl(rows.length - 1)?.querySelector<HTMLElement>("select, input")?.focus();
    } else if (rows.length < prev && removedAt.current !== null) {
      const i = Math.min(removedAt.current, rows.length - 1);
      removedAt.current = null;
      if (i >= 0) rowEl(i)?.querySelector<HTMLElement>("[data-rate-remove]")?.focus();
      else addRef.current?.focus();
    }
  }, [rows.length, loading]);

  const live = loading ? loadingLabel : rows.length === 0 ? emptyLabel : statusLabel ?? "";

  const addButton = (
    <button
      ref={addRef}
      type="button"
      aria-disabled={loading || undefined}
      onClick={() => { if (!loading) onAdd?.(); }}
      className={cn("inline-flex h-11 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60", RING)}
    >
      <Plus className="size-4 shrink-0" aria-hidden />
      <span>{addLabel}</span>
    </button>
  );

  return (
    <div ref={rootRef} aria-busy={loading || undefined} className={cn("flex flex-col gap-3", className)}>
      <span role="status" aria-live="polite" className="sr-only">{live}</span>
      {loading ? (
        <div aria-hidden className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
              {[0, 1, 2, 3, 4].map((j) => <Skeleton key={j} className={cn("h-11", j < 2 && "col-span-2 sm:col-span-1")} />)}
              <Skeleton className="h-11 w-11 justify-self-end" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <p aria-hidden className="text-sm text-muted-foreground">{emptyLabel}</p>
          {addButton}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-3">
              {rows.map((row, i) => {
                const inert = pendingRows.includes(i);
                const failed = errorRows.includes(i);
                const f = (k: string) => `${uid}-${i}-${k}`;
                const emit = (patch: Partial<RateRow>) => { if (!inert) onChange?.(i, { ...row, ...patch }); };
                const open = row.weightMaxG === null;
                return (
                  <div
                    key={row.id ?? `new-${i}`}
                    role="group"
                    data-rate-row={i}
                    aria-busy={inert || undefined}
                    aria-describedby={failed ? f("err") : undefined}
                    className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground", failed ? "border-destructive" : "border-border")}
                  >
                    <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[repeat(2,minmax(0,1.2fr))_repeat(3,minmax(0,1fr))_auto]">
                      {([["origin", originLabel, "originGovernorate"], ["destination", destinationLabel, "destinationGovernorate"]] as const).map(([k, label, key]) => (
                        <div key={k} className="col-span-2 flex flex-col gap-1.5 sm:col-span-1 lg:col-span-1">
                          <label htmlFor={f(k)} className="text-xs font-semibold text-muted-foreground">{label}</label>
                          <select
                            id={f(k)}
                            value={row[key]}
                            aria-disabled={inert || undefined}
                            onChange={(e) => emit({ [key]: e.target.value } as Partial<RateRow>)}
                            className={FIELD}
                          >
                            {governorateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={f("min")} className="text-xs font-semibold text-muted-foreground">{weightMinLabel}</label>
                        <NumberField id={f("min")} value={row.weightMinG} inert={inert} unit={weightUnitLabel} onCommit={(n) => emit({ weightMinG: n })} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={f("max")} className="text-xs font-semibold text-muted-foreground">{weightMaxLabel}</label>
                        {open ? (
                          <span className="flex h-11 items-center rounded-md border border-dashed border-border px-3 text-sm text-foreground">{openEndedLabel}</span>
                        ) : (
                          <NumberField id={f("max")} value={row.weightMaxG as number} inert={inert} unit={weightUnitLabel} onCommit={(n) => emit({ weightMaxG: n })} />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={f("fee")} className="text-xs font-semibold text-muted-foreground">{feeLabel}</label>
                        <NumberField id={f("fee")} value={row.feeEgp} inert={inert} unit={currencyLabel} onCommit={(n) => emit({ feeEgp: n })} />
                      </div>
                      <button
                        type="button"
                        data-rate-remove
                        aria-label={removeLabel}
                        aria-disabled={inert || undefined}
                        onClick={() => { if (inert) return; removedAt.current = i; onRemove?.(i); }}
                        className={cn("inline-flex size-11 items-center justify-center justify-self-end rounded-md border border-border bg-card text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60", RING)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <label className="inline-flex w-fit items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={open}
                        aria-disabled={inert || undefined}
                        onChange={(e) => emit({ weightMaxG: e.target.checked ? null : Math.max(row.weightMinG, 0) })}
                        className={cn("size-4 accent-primary", RING)}
                      />
                      <span>{openEndedLabel}</span>
                    </label>
                    {failed && <p id={f("err")} role="alert" className="text-sm font-medium text-destructive">{errorLabel}</p>}
                  </div>
                );
              })}
            </div>
          </div>
          {addButton}
        </>
      )}
    </div>
  );
}
