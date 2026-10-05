"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Trash2, AlertTriangle, RotateCcw } from "lucide-react";

/**
 * CartLine — one cart line on P66, reused inside checkout P15 (Phase 11).
 * Net-new (CD-DELTA-6 Wave 2, §2.5). Four variants: fixed-price line, custom
 * line (`isCustom`), blocked line (`blockedReason`), dropped-quote prompt
 * (`droppedAfterRestore`, REG-82). Blocked reasons are only "stock" and
 * "quote_expired"; the page computes them (R-C05, R-Q06).
 * Controlled: quantity is never held in local state. The page keeps the
 * previous `quantity` when a change fails and sets `error`.
 * Emits `onQuantityChange`, `onRemove`, `onRequestNewQuote` and nothing more.
 * Remove confirmation is the page's ConfirmDialog (W2-4); no dialog here.
 * Controls use aria-disabled (never `disabled`) while pending or blocked, so
 * focus stays on the control that was used.
 * MUST-NEVER-RENDER: no delivery-fee, commission, buyer-name, buyer-location,
 * phone or agreement field exists on the props type (§2.5 f10, M3, W2-2, W2-3).
 * Token-only. All strings are props (DS-I18N).
 */
export type CartLineBlockedReason = "stock" | "quote_expired";

export interface CartLineProps {
  /** cart_items.id */
  lineId: string;
  /** listings.title_ar / title_en — page picks the locale column. Names the group. */
  title: string;
  /** cart_items.unit_price */
  unitPrice: number;
  /** cart_items.quantity */
  quantity: number;
  /** cart_items.is_custom */
  isCustom: boolean;
  /** listings.stock_qty. Null = untracked; caps increase only when tracked. */
  stockQty: number | null;
  /** inquiries.quote_expires_at. Input to the page's blockedReason; not rendered. */
  quoteExpiresAt?: string | null;
  /** stores.name_ar / name_en */
  storeName: string;
  /** Page-computed. Null = not blocked. */
  blockedReason: CartLineBlockedReason | null;
  /** REG-82 — the custom line is absent after restore. */
  droppedAfterRestore: boolean;
  /** Quantity change in progress: controls inert, focus kept. */
  pending?: boolean;
  /** The last change failed: `errorLabel` shows; page keeps the previous quantity. */
  error?: boolean;
  /** Page-composed result announcement (polite live region), e.g. the new quantity. */
  statusLabel?: string;
  /** Currency unit after the amount (catalog's existing currency string). */
  currencyLabel: string;
  /** cartLine.increase */
  increaseLabel: string;
  /** cartLine.decrease */
  decreaseLabel: string;
  /** cartLine.remove */
  removeLabel: string;
  /** cartLine.blockedStock */
  blockedStockLabel: string;
  /** cartLine.blockedQuote */
  blockedQuoteLabel: string;
  /** cartLine.droppedQuote (additive key proposal) */
  droppedQuoteLabel: string;
  /** cartLine.requestNewQuote */
  requestNewQuoteLabel: string;
  /** cartLine.custom */
  customLabel: string;
  /** cartLine.error */
  errorLabel: string;
  onQuantityChange?: (lineId: string, quantity: number) => void;
  onRemove?: (lineId: string) => void;
  onRequestNewQuote?: (lineId: string) => void;
  className?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-EG").format(n);

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const INERT = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export function CartLine({
  lineId, title, unitPrice, quantity, isCustom, stockQty, storeName, blockedReason, droppedAfterRestore,
  pending = false, error = false, statusLabel, currencyLabel,
  increaseLabel, decreaseLabel, removeLabel, blockedStockLabel, blockedQuoteLabel, droppedQuoteLabel,
  requestNewQuoteLabel, customLabel, errorLabel,
  onQuantityChange, onRemove, onRequestNewQuote, className,
}: CartLineProps) {
  const titleId = React.useId();
  const blocked = blockedReason !== null;
  const locked = blocked || droppedAfterRestore;
  const canDecrease = !locked && !pending && quantity > 1;
  const canIncrease = !locked && !pending && (stockQty === null || quantity < stockQty);
  const showNewQuote = droppedAfterRestore || blockedReason === "quote_expired";
  const notice = droppedAfterRestore ? droppedQuoteLabel
    : blockedReason === "stock" ? blockedStockLabel
    : blockedReason === "quote_expired" ? blockedQuoteLabel : null;

  const step = (next: number, allowed: boolean) => () => { if (allowed) onQuantityChange?.(lineId, next); };

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-busy={pending || undefined}
      className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p id={titleId} className="font-display text-base font-semibold leading-snug text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{storeName}</p>
          {isCustom && (
            <span className="w-fit self-start whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{customLabel}</span>
          )}
        </div>
        {!droppedAfterRestore && (
          <span className="inline-flex shrink-0 items-baseline gap-1">
            <span dir="ltr" className="font-display text-lg font-bold leading-none tabular-nums text-foreground">{fmt(unitPrice)}</span>
            <span className="text-sm font-semibold text-foreground">{currencyLabel}</span>
          </span>
        )}
      </div>

      {notice && (
        <p className="inline-flex w-fit items-center gap-2 rounded-md bg-warning px-3 py-1.5 text-sm font-semibold text-warning-foreground">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>{notice}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!droppedAfterRestore && (
          <div className={cn("inline-flex items-center rounded-full border border-border bg-background", locked && "opacity-60")}>
            <button
              type="button"
              aria-label={decreaseLabel}
              aria-disabled={!canDecrease || undefined}
              onClick={step(quantity - 1, canDecrease)}
              className={cn("inline-flex size-11 items-center justify-center rounded-full text-foreground", RING, INERT)}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span dir="ltr" className="min-w-8 text-center font-semibold tabular-nums text-foreground">{quantity}</span>
            <button
              type="button"
              aria-label={increaseLabel}
              aria-disabled={!canIncrease || undefined}
              onClick={step(quantity + 1, canIncrease)}
              className={cn("inline-flex size-11 items-center justify-center rounded-full text-foreground", RING, INERT)}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 ms-auto">
          {showNewQuote && (
            <button
              type="button"
              aria-disabled={pending || undefined}
              onClick={() => { if (!pending) onRequestNewQuote?.(lineId); }}
              className={cn("inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground", RING, INERT)}
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden />
              <span>{requestNewQuoteLabel}</span>
            </button>
          )}
          <button
            type="button"
            aria-disabled={pending || undefined}
            onClick={() => { if (!pending) onRemove?.(lineId); }}
            className={cn("inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-destructive hover:text-destructive", RING, INERT)}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
            <span>{removeLabel}</span>
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{errorLabel}</p>}
      <span role="status" aria-live="polite" className="sr-only">{statusLabel}</span>
    </div>
  );
}
