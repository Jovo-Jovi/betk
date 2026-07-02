import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * CollectionStrip — titled horizontal carousel (one per live collection).
 * i18n: the "see all" label comes in as a prop (Arabic default). The chevron
 * points in the reading-previous direction and MIRRORS by `dir`: ChevronLeft
 * under RTL, ChevronRight under LTR (pass `dir="ltr"` for en locale).
 */
export interface CollectionStripProps {
  titleAr: string;
  onSeeAll?: () => void;
  /** "See all" link label. Default "عرض الكل". */
  seeAllLabel?: string;
  /** Reading direction — flips the chevron. Default "rtl". */
  dir?: "rtl" | "ltr";
  itemWidth?: number;
  children?: React.ReactNode;
  className?: string;
}

export function CollectionStrip({ titleAr, onSeeAll, seeAllLabel = "عرض الكل", dir = "rtl", itemWidth = 168, children, className }: CollectionStripProps) {
  const Chevron = dir === "ltr" ? ChevronRight : ChevronLeft;
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-foreground">{titleAr}</h2>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary">
            {seeAllLabel} <Chevron className="size-4" />
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
