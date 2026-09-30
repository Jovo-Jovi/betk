"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * DataTable — the one table for seller + admin lists (CD-DELTA-6 Wave 1).
 * Two-layer: composes the VANILLA shadcn `ui/table` (official CLI add, §8d).
 * Fully controlled: `sort` / `pageIndex` / `pageCount` come in, `onSortChange`
 * / `onPageChange` go out — the table never fetches and holds no sort/page
 * state. Cells are page-formatted strings. The page declares LTR islands per
 * column (`ltr: true` → amounts/refs/phones/digits); the table never guesses
 * from script. Mobile (§8d): one table, inline-axis scroll region — no second
 * stacked layout. No column allow-list (§8j): the kit defines no buyer-identity,
 * address, city, delivery-fee or order-total column; page review enforces N28.
 * Token-only. All strings are props (DS-I18N).
 */
export interface DataTableColumn {
  id: string;
  /** Header text (string prop). */
  header: string;
  /** Header emits onSortChange when true. Default false. */
  sortable?: boolean;
  /** Cell is an LTR island (amount / reference / phone / digits). */
  ltr?: boolean;
}

export interface DataTableSort {
  columnId: string;
  direction: "asc" | "desc";
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, string>[];
  /** Optional stable row key column; defaults to row index. */
  rowKey?: string;
  /**
   * CD-DELTA-6 (decision n): row destination. When it returns a URL, the first
   * column's cell renders as a real link (one keyboard stop per row). No row
   * click handler. Absent, or returns undefined → plain cell.
   */
  rowHref?: (row: Record<string, string>) => string | undefined;
  sort?: DataTableSort | null;
  onSortChange?: (next: DataTableSort) => void;
  /** 0-based. Pagination renders when pageCount > 1. */
  pageIndex?: number;
  pageCount?: number;
  onPageChange?: (nextIndex: number) => void;
  loading?: boolean;
  /** Skeleton row count while loading. Default 5. */
  loadingRows?: number;
  /** When true, errorLabel + retry replace the rows. */
  error?: boolean;
  onRetry?: () => void;
  /** dataTable.caption — table caption (visually hidden unless showCaption). */
  caption: string;
  showCaption?: boolean;
  /** dataTable.empty — admin queues pass a positive "queue is clear" string. */
  emptyLabel: string;
  /** dataTable.error */
  errorLabel: string;
  /** dataTable.retry */
  retryLabel: string;
  /** dataTable.previous */
  previousLabel: string;
  /** dataTable.next */
  nextLabel: string;
  /** Page-composed "page 2 of 7" string shown between the arrows and announced on change. */
  pageStatusLabel?: string;
  /** Page-composed sort announcement (e.g. "sorted by date, descending"); announced on change. */
  sortStatusLabel?: string;
  className?: string;
}

export function DataTable({
  columns, rows, rowKey, rowHref, sort = null, onSortChange, pageIndex = 0, pageCount = 1, onPageChange,
  loading = false, loadingRows = 5, error = false, onRetry,
  caption, showCaption = false, emptyLabel, errorLabel, retryLabel, previousLabel, nextLabel,
  pageStatusLabel, sortStatusLabel, className,
}: DataTableProps) {
  const span = Math.max(columns.length, 1);

  const nextSort = (c: DataTableColumn): DataTableSort =>
    sort?.columnId === c.id ? { columnId: c.id, direction: sort.direction === "asc" ? "desc" : "asc" } : { columnId: c.id, direction: "asc" };

  const ariaSort = (c: DataTableColumn): React.AriaAttributes["aria-sort"] =>
    !c.sortable ? undefined : sort?.columnId === c.id ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  let body: React.ReactNode;
  if (loading) {
    body = Array.from({ length: loadingRows }).map((_, r) => (
      <TableRow key={`sk-${r}`} className="hover:bg-transparent">
        {columns.map((c, ci) => (
          <TableCell key={c.id}><Skeleton className={cn("h-3", ci === 0 ? "w-[70%]" : "w-[50%]")} /></TableCell>
        ))}
      </TableRow>
    ));
  } else if (error) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={span} className="py-10 text-center">
          <div role="alert" className="flex flex-col items-center gap-3">
            <span className="text-sm font-medium text-destructive">{errorLabel}</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {retryLabel}
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={span} className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row, r) => {
      const dest = rowHref?.(row);
      return (
        <TableRow key={rowKey ? row[rowKey] ?? r : r}>
          {columns.map((c, ci) => {
            const content = c.ltr ? <span dir="ltr" className="inline-block font-mono tabular-nums">{row[c.id]}</span> : row[c.id];
            return (
              <TableCell key={c.id} className="text-foreground">
                {ci === 0 && dest
                  ? <a href={dest} className="rounded-sm font-semibold text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</a>
                  : content}
              </TableCell>
            );
          })}
        </TableRow>
      );
    });
  }

  const showPager = pageCount > 1;
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="w-full overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label={caption} tabIndex={0}>
        <Table>
          <TableCaption className={cn(showCaption ? "pb-3 text-muted-foreground" : "sr-only")}>{caption}</TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => {
                const active = sort?.columnId === c.id;
                const SortIcon = !active ? ArrowUpDown : sort!.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead key={c.id} aria-sort={ariaSort(c)} className="whitespace-nowrap text-start text-xs font-semibold uppercase tracking-[0.03em] text-muted-foreground">
                    {c.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(nextSort(c))}
                        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}
                      >
                        {c.header}
                        <SortIcon className={cn("size-3.5", !active && "opacity-60")} aria-hidden />
                      </button>
                    ) : c.header}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody aria-busy={loading || undefined}>{body}</TableBody>
        </Table>
      </div>
      {showPager && (
        <nav className="flex items-center justify-end gap-2" aria-label={caption}>
          <button
            type="button" aria-label={previousLabel} disabled={pageIndex <= 0 || loading}
            onClick={() => onPageChange?.(pageIndex - 1)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <ChevronRight className="size-4 ltr:rotate-180" aria-hidden />
          </button>
          {pageStatusLabel && <span className="px-1 text-sm text-muted-foreground">{pageStatusLabel}</span>}
          <button
            type="button" aria-label={nextLabel} disabled={pageIndex >= pageCount - 1 || loading}
            onClick={() => onPageChange?.(pageIndex + 1)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
          </button>
        </nav>
      )}
      <span role="status" aria-live="polite" className="sr-only">{[sortStatusLabel, pageStatusLabel].filter(Boolean).join(" · ")}</span>
    </div>
  );
}
