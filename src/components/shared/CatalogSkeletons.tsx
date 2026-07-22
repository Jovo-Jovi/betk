import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Catalog skeletons — section-level loading surfaces that MATCH the final
 * layout (UI Spec §6). Compose the base ui/skeleton primitive. Each strip
 * gets its own skeleton so T02 section degradation can render it standalone.
 */

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2.5 p-3">
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-4 w-[55%]" />
        <Skeleton className="h-2.5 w-[70%]" />
        <Skeleton className="h-5 w-[40%] rounded-full" />
      </div>
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="h-16 w-full rounded-none" />
      <div className="-mt-7 flex flex-col gap-2.5 px-3.5 pb-3.5">
        <Skeleton className="size-14 rounded-full border-[3px] border-card" />
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-2.5 w-[80%]" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Listing grid skeleton (Search/Category/Home/Storefront/Wishlist). */
export function SkeletonGrid({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => <ListingCardSkeleton key={i} />)}
    </div>
  );
}

/** Bespoke CategoryGrid loading surface — muted circle tiles (UI Spec §3). */
export function CategoryGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3.5">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-2.5 w-[70%]" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton (seller/admin lists). */
export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid items-center gap-3 rounded-md border border-border bg-card p-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className={cn("h-3", c === 0 ? "w-[60%]" : "w-[80%]")} />)}
        </div>
      ))}
    </div>
  );
}

/* ── CD-DELTA-4 (REG-38a): route-transition skeletons ────────────────────────
 * Full-page fallbacks that match each route's final layout, for streaming
 * Suspense on the category / listing-detail / storefront transitions. Additive
 * exports only — compose the section-level skeletons above.
 */

/** Category / listing-index transition: header row + filter-pill row + grid. */
export function CategoryPageSkeleton({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-[40%]" />
        <Skeleton className="h-3 w-[24%]" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />)}
      </div>
      <SkeletonGrid count={count} />
    </div>
  );
}

/** Listing-detail transition: gallery (main + thumb row) + info column. */
export function ListingDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-2", className)}>
      <div className="flex flex-col gap-3">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="size-16 rounded-md" />)}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-[35%]" />
        <Skeleton className="h-6 w-[80%]" />
        <Skeleton className="h-7 w-[30%]" />
        <div className="mt-2 flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-[45%]" />
            <Skeleton className="h-2.5 w-[30%]" />
          </div>
        </div>
        <Skeleton className="mt-2 h-10 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Storefront transition: cover banner + store header + tab row + listing grid. */
export function StorefrontSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="-mt-12 flex items-end gap-4 px-2">
        <Skeleton className="size-20 rounded-full border-4 border-card" />
        <div className="flex flex-1 flex-col gap-2 pb-1">
          <Skeleton className="h-5 w-[45%]" />
          <Skeleton className="h-2.5 w-[30%]" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex gap-1 border-b-2 border-border">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-t-md" />)}
      </div>
      <SkeletonGrid count={count} />
    </div>
  );
}
