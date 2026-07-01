import * as React from "react";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";

/**
 * CategoryGrid — homepage category tiles (icon circle + Arabic name) in an
 * auto-fit grid. `icon` takes any node (Lucide recommended).
 */
export interface CategoryItem {
  id?: string;
  nameAr: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface CategoryGridProps {
  categories: CategoryItem[];
  className?: string;
}

export function CategoryGrid({ categories, className }: CategoryGridProps) {
  return (
    <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3", className)}>
      {categories.map((c, i) => (
        <button
          key={c.id ?? i}
          type="button"
          onClick={c.onClick}
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3.5 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {c.icon ?? <Tag className="size-5" />}
          </span>
          <span className="text-[0.8125rem] font-semibold leading-tight text-foreground">{c.nameAr}</span>
        </button>
      ))}
    </div>
  );
}
