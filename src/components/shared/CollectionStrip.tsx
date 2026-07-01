import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

/**
 * CollectionStrip — titled horizontal carousel (one per live collection).
 * RTL-aware: scrolls start→end; the "عرض الكل" chevron points to previous-
 * direction per RTL (ChevronLeft). Children get a fixed itemWidth slot.
 */
export interface CollectionStripProps {
  titleAr: string;
  onSeeAll?: () => void;
  itemWidth?: number;
  children?: React.ReactNode;
  className?: string;
}

export function CollectionStrip({ titleAr, onSeeAll, itemWidth = 168, children, className }: CollectionStripProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-foreground">{titleAr}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary">
            عرض الكل <ChevronLeft className="size-4" />
          </button>
        )}
      </header>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {React.Children.map(children, (child) => (
          <div className="shrink-0" style={{ flexBasis: itemWidth, width: itemWidth }}>{child}</div>
        ))}
      </div>
    </section>
  );
}
