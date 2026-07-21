"use server";

/**
 * Listing image management — Phase 05 / T02 (FR-SEL-9, R-L02). addListingImage
 * / removeListingImage / reorderListingImages. None throw — each returns a
 * discriminated result.
 *
 * UPLOAD CONTRACT: the client uploads the file to the PUBLIC `media` bucket
 * under its OWN prefix (`${uid}/…`, the T01-Phase-04 storage RLS) and passes the
 * resulting public URL. addListingImage RE-CHECKS own-prefix ownership
 * server-side (ownsMediaPrefix) and rejects a URL outside the caller's prefix
 * (`forbidden_path`) — defense-in-depth over the upload-time policy.
 *
 * ≤5 images: enforced app-side against the current row count (there is no DB
 * count constraint — only the per-row chk_listing_img_order sort_order 0..4).
 * Hero = sort_order 0.
 *
 * ── STORAGE RETENTION POSTURE (deliberate, FLAG-1 / T01-verified) ───────────
 * The `media` bucket has NO storage DELETE policy (own-prefix INSERT/UPDATE +
 * public read only — the store-avatar / R-S08 posture). removeListingImage
 * therefore deletes only the `listing_images` DB ROW (authorized by the T01
 * `listing_images_seller` FOR ALL policy); the underlying storage OBJECT is
 * INTENTIONALLY LEFT IN PLACE at its path. Image replacement is likewise
 * new-upload-to-a-new-path (never an in-place object delete). We do NOT
 * improvise a storage DELETE policy. A candidate orphaned-object cleanup job
 * (sweep media objects with no referencing row) is a POST-MVP note — NOT built
 * here. This is a recorded, deliberate decision, not an oversight.
 *
 * Own-store scope on every op (parent listing's store = caller, via the T01
 * parent-scoped `listing_images_seller` RLS + an explicit ownership pre-check).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  addListingImageSchema,
  removeListingImageSchema,
  reorderListingImagesSchema,
  type AddListingImageInput,
  type RemoveListingImageInput,
  type ReorderListingImagesInput,
  type AddListingImageResult,
  type RemoveListingImageResult,
  type ReorderListingImagesResult,
} from "@/validations/listings";
import { ownsMediaPrefix } from "@/features/listings/listingRules";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { resolveCallerStoreId, type ListingsClient } from "../queries/_shared";

const MAX_IMAGES = 5;

type Gate =
  | { ok: true; userId: string; storeId: string; supabase: ListingsClient }
  | { ok: false; reason: "unauthenticated" | "blocked" | "no_store" | "error" };

/** Shared auth + own-store resolution for every image op. */
async function gate(): Promise<Gate> {
  setFeatureContext("listing");
  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "listing", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }
  Sentry.setUser({ id: userId });
  const supabase = await createClient();
  const scope = await resolveCallerStoreId(supabase);
  if (!scope) return { ok: false, reason: "no_store" };
  return { ok: true, userId, storeId: scope.storeId, supabase };
}

/** Confirms the listing exists and belongs to the caller's store. */
async function ownsListing(
  supabase: ListingsClient,
  listingId: string,
  storeId: string,
): Promise<boolean> {
  const { data } = await supabase
    .schema("betk")
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("store_id", storeId)
    .maybeSingle();
  return !!data;
}

export async function addListingImage(
  input: AddListingImageInput,
): Promise<AddListingImageResult> {
  const parsed = addListingImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId, url, sortOrder } = parsed.data;

  const g = await gate();
  if (!g.ok) return g;

  // Server-side own-prefix re-check (never trust the client's upload path).
  if (!ownsMediaPrefix(url, g.userId)) {
    // NOTE: the url embeds the uid (accepted id-not-PII posture) — safe to omit
    // from the event regardless; we log only the step.
    return { ok: false, reason: "forbidden_path" };
  }

  if (!(await ownsListing(g.supabase, listingId, g.storeId))) {
    return { ok: false, reason: "not_found" };
  }

  const { count, error: countErr } = await g.supabase
    .schema("betk")
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (countErr) {
    captureTaggedError(countErr, "listing", { extra: { step: "imageCount" } });
    return { ok: false, reason: "error" };
  }
  if ((count ?? 0) >= MAX_IMAGES) {
    return { ok: false, reason: "limit_reached" };
  }

  const { data, error } = await g.supabase
    .schema("betk")
    .from("listing_images")
    .insert({ listing_id: listingId, url, sort_order: sortOrder })
    .select("id")
    .single();

  if (error || !data) {
    captureTaggedError(error ?? new Error("addListingImage: no row"), "listing", {
      extra: { step: "insertImage" },
    });
    return { ok: false, reason: "error" };
  }

  return { ok: true, imageId: data.id };
}

export async function removeListingImage(
  input: RemoveListingImageInput,
): Promise<RemoveListingImageResult> {
  const parsed = removeListingImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { imageId } = parsed.data;

  const g = await gate();
  if (!g.ok) return g;

  // Delete only the DB ROW — the storage object is intentionally retained (see
  // the file header: media has no DELETE policy by design). RLS
  // (listing_images_seller, parent-store-scoped) filters out a foreign row → 0
  // rows deleted → not_found.
  const { data, error } = await g.supabase
    .schema("betk")
    .from("listing_images")
    .delete()
    .eq("id", imageId)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: "removeImage" } });
    return { ok: false, reason: "error" };
  }
  if ((data?.length ?? 0) === 0) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}

export async function reorderListingImages(
  input: ReorderListingImagesInput,
): Promise<ReorderListingImagesResult> {
  const parsed = reorderListingImagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId, imageIds } = parsed.data;

  const g = await gate();
  if (!g.ok) return g;

  if (!(await ownsListing(g.supabase, listingId, g.storeId))) {
    return { ok: false, reason: "not_found" };
  }

  // Assign sort_order = position (hero = 0). Each UPDATE is RLS-scoped to the
  // owning store and pinned to this listing, so a stray id can't touch another
  // listing's row.
  for (let i = 0; i < imageIds.length; i++) {
    const { error } = await g.supabase
      .schema("betk")
      .from("listing_images")
      .update({ sort_order: i })
      .eq("id", imageIds[i]!)
      .eq("listing_id", listingId);
    if (error) {
      captureTaggedError(error, "listing", { extra: { step: "reorderImage", index: i } });
      return { ok: false, reason: "error" };
    }
  }

  return { ok: true };
}
