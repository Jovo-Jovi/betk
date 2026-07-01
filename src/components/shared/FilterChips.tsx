import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * FilterChips — active-filter row above search/category results. Per-chip
 * remove (×) + "مسح الكل" when more than one. Renders null when empty.
 */
export interface FilterChip {
  id: string;
  label: string;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterChips({ chips, onRemove, onClearAll, className }: FilterChipsProps) {
  if (!chips?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pe-2.5 ps-1 text-[0.8125rem] font-semibold text-primary">
          {c.label}
          <button
            type="button"
            onClick={() => onRemove?.(c.id)}
            aria-label={`إزالة ${c.label}`}
            className="inline-flex size-[18px] items-center justify-center rounded-full bg-primary/20"
          >
            <X className="size-[11px]" />
          </button>
        </span>
      ))}
      {chips.length > 1 && onClearAll && (
        <button type="button" onClick={onClearAll} className="text-[0.8125rem] font-semibold text-muted-foreground underline">
          مسح الكل
        </button>
      )}
    </div>
  );
}
