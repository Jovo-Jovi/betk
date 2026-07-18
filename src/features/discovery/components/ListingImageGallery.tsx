"use client";

/**
 * ListingImageGallery — thin client-boundary wrapper around the untouched
 * `ImageGallery` (Claude-Design/shared kit). Phase 03 / T05.
 *
 * FINDING (live-verified via runtime smoke, NOT fixed in `shared/*` — this
 * task's binding rule is "no ui/* or shared/* edits"): `ImageGallery.tsx`
 * calls `React.useState` but has no `"use client"` directive of its own —
 * every OTHER hook-using component in `components/shared` does have one
 * (`ConfirmDialog`, `AddressForm`, `MessageThread`, `AppTopbar`,
 * `MobileBottomNav`, `ImageUploader`, `ConsoleSidebar`, `Toaster`, `Footer`).
 * Because this page is the FIRST real consumer of `ImageGallery` (no other
 * page in the repo renders it), the gap was never caught before: imported
 * directly into a Server Component, its `useState` call crashes at request
 * time (`TypeError: e.useState is not a function`, confirmed via `next
 * start` + a live request during T05's runtime smoke). Flagged for a
 * dedicated Claude-Design fix (`"use client"` added to `ImageGallery.tsx`
 * itself) in a later task — worked around HERE, at the composition layer
 * only, by re-establishing the client boundary one file up. No shared/ui
 * bytes touched.
 */

import { ImageGallery, type ImageGalleryProps } from "@/components/shared";

export function ListingImageGallery(props: ImageGalleryProps) {
  return <ImageGallery {...props} />;
}
