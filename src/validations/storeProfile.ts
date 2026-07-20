/**
 * Store-profile settings schema (Zod) — Phase 04 / T06 (FR-SEL-4).
 *
 * Validates every field of the /seller/store profile form BEFORE the
 * `updateStoreProfile` Server Action touches the DB (CI `check-zod-coverage`).
 * Shapes mirror the editable `betk.stores` columns (BETK_DATABASE_SCHEMA):
 * `name_ar` required / `name_en` optional (COALESCE display set); `bio_ar`
 * as-authored; `category_primary` required + `category_secondary` optional
 * (FREE-TEXT columns per schema, NOT FKs — the picker's chosen value is stored
 * as text); `governorate` required + `city` optional; `min_order_egp` numeric
 * bounds; `avatar_url` / `cover_url` are the PUBLIC media-bucket URLs the client
 * produced after upload (own-prefix, T01 media RLS).
 *
 * SLUG (R-S02/R-S03): the slug is always sent; the ACTION compares it to the
 * stored value and only writes `slug` + `slug_changed_at=now()` together when it
 * actually changed AND `slug_changed_at IS NULL` (change-once, server-guarded —
 * the UI lock is cosmetic). Uniqueness is authoritative via the 23505 catch, not
 * the UX pre-check.
 */

import { z } from "zod";
import { storeSlugInputSchema } from "@/validations/sellerOnboarding";

/**
 * A public media URL the client stored to the media bucket under its OWN prefix
 * (T01 media RLS). Shape-only here (a bounded http(s) URL); the value is a
 * public URL by design — the seller's uid appears in the path (accepted
 * id-not-PII posture, consistent with Sentry id-only).
 */
export const publicMediaUrlSchema = z.string().trim().url().max(2000);

/** Minimum accepted image dimensions (px) — validated CLIENT-SIDE before upload. */
export const AVATAR_MIN_DIMENSIONS = { width: 200, height: 200 } as const;
export const COVER_MIN_DIMENSIONS = { width: 1200, height: 400 } as const;

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Pure dimension gate (testable without a DOM): true only when BOTH sides meet
 * the minimum. Undersized images are rejected before any upload happens.
 */
export function meetsMinDimensions(dim: ImageDimensions, min: ImageDimensions): boolean {
  return (
    Number.isFinite(dim.width) &&
    Number.isFinite(dim.height) &&
    dim.width >= min.width &&
    dim.height >= min.height
  );
}

/**
 * Full store-profile update payload. Every optional string collapses to
 * `undefined` when blank (the action maps `undefined` → `null` so a cleared
 * field is truly absent, not `""`). `avatarUrl` / `coverUrl` are omitted from
 * the write when `undefined` (an unchanged image is never wiped).
 */
export const updateStoreProfileSchema = z.object({
  nameAr: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().min(2).max(100).optional(),
  bioAr: z.string().trim().max(200).optional(),
  slug: storeSlugInputSchema,
  categoryPrimary: z.string().trim().min(1).max(50),
  categorySecondary: z.string().trim().min(1).max(50).optional(),
  governorate: z.string().trim().min(1).max(50),
  city: z.string().trim().min(1).max(100).optional(),
  minOrderEgp: z.number().nonnegative().max(1000000).optional(),
  avatarUrl: publicMediaUrlSchema.optional(),
  coverUrl: publicMediaUrlSchema.optional(),
});

export type UpdateStoreProfileInput = z.input<typeof updateStoreProfileSchema>;
export type UpdateStoreProfileParsed = z.infer<typeof updateStoreProfileSchema>;

/**
 * Discriminated result of `updateStoreProfile`. Never throws to the client; the
 * form routes on `reason`:
 *   - unauthenticated → /auth/login
 *   - blocked         → /blocked (R-A05 deactivated/not-active)
 *   - no_store        → defensive (a seller should always have a store)
 *   - slug_taken      → field-level "slug taken" error (R-S02, 23505 authoritative)
 *   - slug_locked     → the change-once guard bit (slug already spent, R-S03)
 *   - invalid         → inline validation error (Zod)
 *   - error           → generic inline error
 * On success, `slugChanged` tells the UI to refresh the lock indicator.
 */
export type UpdateStoreProfileResult =
  | { ok: true; slugChanged: boolean }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "blocked"
        | "no_store"
        | "slug_taken"
        | "slug_locked"
        | "invalid"
        | "error";
    };
