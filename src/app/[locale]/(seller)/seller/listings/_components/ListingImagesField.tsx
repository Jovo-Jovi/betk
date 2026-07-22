"use client";

/**
 * ListingImagesField — the ≤5 ordered image gallery editor for the Create/
 * Edit Listing form. Phase 05 / T04 (R-L02, FLAG-2 upload contract).
 *
 * Only rendered once a listingId exists (edit mode — a fresh "new" draft has
 * no id yet to attach image rows to; the create form shows a hint instead
 * and the seller is routed here immediately after the first draft save).
 *
 * UPLOAD CONTRACT (Phase-04 T04 precedent, FLAGGED for T04): the browser
 * uploads DIRECTLY to the PUBLIC `media` bucket under the caller's OWN
 * prefix (`${uid}/listings/${listingId}/…`, first path segment = uid — the
 * T01 storage RLS own-prefix contract) via the authenticated browser client,
 * then the resulting PUBLIC url is handed to the `addListingImage` Server
 * Action, which RE-CHECKS own-prefix ownership server-side (defense in
 * depth) and is the ≤5 AUTHORITATIVE gate (`limit_reached`) — this
 * component's own `MAX_IMAGES` client-side cap is UX-only, enforced first so
 * the dropzone visibly disables at 5/5, never the final word.
 *
 * PER-FILE RETRY: each slot tracks its own status independently. A storage-
 * upload failure retries the WHOLE upload (re-picks the same File); an
 * `addListingImage` failure (storage object already landed) retries ONLY the
 * DB-row insert against the same already-uploaded public url — never a
 * second storage upload for the same file.
 *
 * REORDER: plain up/down controls (no drag library) — index 0 is always the
 * hero. Every reorder/remove re-normalizes `sort_order` to 0..n-1 via
 * `reorderListingImages` so the hero stays contiguous (chk_listing_img_order).
 *
 * RETENTION POSTURE (ADR-013 / FLAG-1, ported verbatim from the T02 action
 * header — restated here because this is the ONLY place a removal is
 * triggered from the UI): removing an image deletes just the `listing_images`
 * DB row. The underlying `media` bucket object is intentionally LEFT IN
 * PLACE — there is no storage DELETE policy by design (own-prefix
 * INSERT/UPDATE + public-read only), and this component does NOT improvise
 * one. Replacing a photo is therefore always "remove row + upload to a new
 * path", never an in-place object overwrite.
 *
 * Fully self-contained: owns its own local gallery state (seeded once from
 * `initialImages`), independent of the parent form's save/publish cycle — no
 * `router.refresh()` is needed here (StoreProfileForm avatar/cover precedent).
 * `publishListing`'s own live `listing_images` count is what the server
 * trusts at publish time (R-L02), not anything read from this component.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
// Import the actions DIRECTLY (NOT the feature barrel) — the barrel also
// re-exports @/lib/supabase/server-backed queries, which would leak
// next/headers into this client bundle (ListingsList / T03 precedent).
import {
  addListingImage,
  removeListingImage,
  reorderListingImages,
} from "@/features/listings/actions/manageListingImages";
import { ImageUploader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, X } from "lucide-react";

const MAX_IMAGES = 5;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function extFor(file: File): string {
  return MIME_EXT[file.type] ?? (file.name.split(".").pop() || "img").toLowerCase();
}

type SlotStatus = "uploading" | "saving" | "uploaded" | "error";

interface ImageSlot {
  /** Stable React key — the real `listing_images.id` once persisted, else a local temp id. */
  key: string;
  imageId?: string;
  /** Object-URL preview while uploading, else the persisted public url. */
  previewUrl: string;
  /** Set once the storage upload succeeds — lets a DB-insert retry skip re-uploading. */
  publicUrl?: string;
  status: SlotStatus;
  file?: File;
}

export interface ListingImagesFieldProps {
  listingId: string;
  uid: string;
  mediaBucket: string;
  initialImages: { id: string; url: string; sortOrder: number }[];
}

export function ListingImagesField({ listingId, uid, mediaBucket, initialImages }: ListingImagesFieldProps) {
  const t = useTranslations("seller.listings.form.images");
  const supabase = React.useMemo(() => createClient(), []);

  const [slots, setSlots] = React.useState<ImageSlot[]>(() =>
    initialImages
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ key: img.id, imageId: img.id, previewUrl: img.url, publicUrl: img.url, status: "uploaded" as const })),
  );

  const uploadedCount = slots.filter((s) => s.status !== "error").length;
  const atLimit = uploadedCount >= MAX_IMAGES;

  /** Re-normalizes sort_order 0..n-1 for the currently persisted (uploaded) slots. */
  const persist = React.useCallback(
    async (persistedIds: string[]) => {
      if (persistedIds.length === 0) return;
      const res = await reorderListingImages({ listingId, imageIds: persistedIds });
      if (!res.ok) toast.error(t("reorderFailed"));
    },
    [listingId, t],
  );

  const uploadToStorage = React.useCallback(
    async (key: string, file: File): Promise<string | null> => {
      const path = `${uid}/listings/${listingId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extFor(file)}`;
      const { error } = await supabase.storage
        .from(mediaBucket)
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) {
        setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, status: "error" } : s)));
        toast.error(t("uploadFailed"));
        return null;
      }
      const { data: pub } = supabase.storage.from(mediaBucket).getPublicUrl(path);
      return pub.publicUrl;
    },
    [supabase, mediaBucket, uid, listingId, t],
  );

  const saveRow = React.useCallback(
    async (key: string, publicUrl: string) => {
      setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, status: "saving", publicUrl } : s)));
      const sortOrder = Math.min(slots.filter((s) => s.status === "uploaded").length, 4);
      const res = await addListingImage({ listingId, url: publicUrl, sortOrder });
      if (!res.ok) {
        setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, status: "error", publicUrl } : s)));
        toast.error(res.reason === "limit_reached" ? t("maxReached") : t("addFailed"));
        return;
      }
      setSlots((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, status: "uploaded", imageId: res.imageId, previewUrl: publicUrl, publicUrl } : s,
        ),
      );
    },
    [listingId, slots, t],
  );

  const runUpload = React.useCallback(
    async (key: string, file: File) => {
      const publicUrl = await uploadToStorage(key, file);
      if (!publicUrl) return;
      await saveRow(key, publicUrl);
    },
    [uploadToStorage, saveRow],
  );

  function onFiles(files: File[]) {
    const remaining = MAX_IMAGES - uploadedCount;
    if (remaining <= 0 || files.length === 0) return;
    const picked = files.slice(0, remaining);
    for (const file of picked) {
      const key = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setSlots((prev) => [...prev, { key, previewUrl, status: "uploading", file }]);
      void runUpload(key, file);
    }
  }

  function retry(slot: ImageSlot) {
    if (slot.publicUrl) {
      void saveRow(slot.key, slot.publicUrl);
      return;
    }
    if (slot.file) {
      setSlots((prev) => prev.map((s) => (s.key === slot.key ? { ...s, status: "uploading" } : s)));
      void runUpload(slot.key, slot.file);
    }
  }

  async function remove(slot: ImageSlot) {
    if (!slot.imageId) {
      // Never made it to a DB row (upload/save failed) — just drop it locally.
      setSlots((prev) => prev.filter((s) => s.key !== slot.key));
      return;
    }
    const res = await removeListingImage({ imageId: slot.imageId });
    if (!res.ok) {
      toast.error(t("removeFailed"));
      return;
    }
    const remainingIds = slots.filter((s) => s.key !== slot.key && s.status === "uploaded" && s.imageId).map((s) => s.imageId!);
    setSlots((prev) => prev.filter((s) => s.key !== slot.key));
    await persist(remainingIds);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    const next = slots.slice();
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSlots(next);
    const persistedIds = next.filter((s) => s.status === "uploaded" && s.imageId).map((s) => s.imageId!);
    await persist(persistedIds);
  }

  return (
    <div className="flex flex-col gap-3">
      {!atLimit && (
        <ImageUploader label={t("uploadLabel")} hint={t("uploadHint")} files={[]} onFiles={onFiles} />
      )}
      {atLimit && <p className="text-xs text-muted-foreground">{t("maxReached")}</p>}

      {slots.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {slots.map((slot, i) => (
            <div key={slot.key} className="flex w-28 flex-col gap-1.5">
              <div className="relative size-28 overflow-hidden rounded-md border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- media bucket / blob preview url */}
                <img src={slot.previewUrl} alt="" className="size-full object-cover" />
                {(slot.status === "uploading" || slot.status === "saving") && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs font-medium text-foreground">
                    …
                  </div>
                )}
                {i === 0 && slot.status === "uploaded" && (
                  <span className="absolute start-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {t("hero")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(slot)}
                  aria-label={t("remove")}
                  className="absolute end-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>

              {slot.status === "error" ? (
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => retry(slot)}>
                  {t("retry")}
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    aria-label={t("moveUp")}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("moveDown")}
                    disabled={i === slots.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
