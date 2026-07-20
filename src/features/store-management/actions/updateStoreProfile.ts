"use server";

/**
 * updateStoreProfile — Phase 04 / T06 (FR-SEL-4). Saves the seller's store
 * profile settings. Never throws to the client — returns a discriminated
 * `UpdateStoreProfileResult` the form routes on.
 *
 * ATOMICITY (ADR-012 scope): this is a SINGLE-TABLE `betk.stores` UPDATE, so it
 * is atomically fine on its own — PostgREST wraps one statement in one
 * transaction. ADR-012's RPC decision was for the MULTI-table become-seller
 * submit (seller_profiles + stores + 2 documents); no rpc is needed here.
 *
 * OWN-ROW (belt & suspenders): the write runs under the authenticated cookie
 * client, so the `stores_manage` RLS policy (USING seller_id = auth.uid() OR
 * betk.is_admin()) is the authz boundary; the uid is ALSO read from the live
 * GoTrue session and pinned into the WHERE (`.eq("seller_id", uid)`) so the
 * action can only ever touch the caller's own row, never a form-supplied id.
 *
 * SLUG CHANGE-ONCE (R-S03) — server-authoritative, the UI lock is cosmetic:
 *   • The current `slug` + `slug_changed_at` are read first.
 *   • A slug change is requested only when the submitted slug differs.
 *   • If a change is requested while `slug_changed_at IS NOT NULL` → reject
 *     (`slug_locked`) BEFORE any write — never trust the client's lock state.
 *   • When allowed, `slug` + `slug_changed_at=now()` are written TOGETHER, and
 *     the UPDATE is additionally guarded with `slug_changed_at IS NULL` so a
 *     concurrent second change can't slip through (0 rows updated → slug_locked).
 *   • DB NOTE (register finding): NO trigger/CHECK/constraint enforces R-S03 at
 *     the DB layer today (`betk.stores` has only chk_store_slug_fmt / uq_stores_
 *     slug / uq_stores_seller). This APP-LAYER guard is the sole enforcer —
 *     candidate hardening = a trigger rejecting a slug UPDATE when
 *     slug_changed_at IS NOT NULL. No DB object is added in this task.
 *   • Uniqueness (R-S02) is authoritative via the 23505 catch on uq_stores_slug
 *     → field-level `slug_taken`; the availability pre-check is UX-only.
 *
 * MEDIA: `avatar_url` / `cover_url` hold the PUBLIC media-bucket URLs the client
 * produced (own-prefix upload, T01 media RLS). The public URL embeds the
 * seller's uid in its path — the accepted id-not-PII posture (consistent with
 * Sentry id-only), not a leak.
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
  updateStoreProfileSchema,
  type UpdateStoreProfileInput,
  type UpdateStoreProfileResult,
} from "@/validations/storeProfile";
import type { Database } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

type StoreUpdate = Database["betk"]["Tables"]["stores"]["Update"];

export async function updateStoreProfile(
  input: UpdateStoreProfileInput,
): Promise<UpdateStoreProfileResult> {
  setFeatureContext("store-management");

  // ── Zod validation (before any DB call) ─────────────────────────────────────
  const parsed = updateStoreProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const p = parsed.data;

  // ── Session identity (R-A05) — never trust a form-supplied id ───────────────
  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "store-management", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  const supabase = await createClient();

  // ── Read current slug + lock state (own-row, self-scope RLS) ────────────────
  const { data: current, error: readError } = await supabase
    .schema("betk")
    .from("stores")
    .select("slug, slug_changed_at")
    .eq("seller_id", userId)
    .maybeSingle();

  if (readError) {
    captureTaggedError(readError, "store-management", { extra: { step: "readCurrent" } });
    return { ok: false, reason: "error" };
  }
  if (!current) {
    // Defensive: a seller should always have a store (ADR-012 atomic submit).
    return { ok: false, reason: "no_store" };
  }

  const slugChangeRequested = p.slug !== current.slug;

  // ── R-S03 server guard: reject a slug change once slug_changed_at is set ─────
  if (slugChangeRequested && current.slug_changed_at !== null) {
    return { ok: false, reason: "slug_locked" };
  }

  // ── Build the single-table update (non-slug fields always) ──────────────────
  const update: StoreUpdate = {
    name_ar: p.nameAr,
    name_en: p.nameEn ?? null,
    bio_ar: p.bioAr ?? null,
    category_primary: p.categoryPrimary,
    category_secondary: p.categorySecondary ?? null,
    governorate: p.governorate,
    city: p.city ?? null,
    min_order_egp: p.minOrderEgp ?? null,
  };
  // An unchanged image is never wiped — only write a URL when the client sent one.
  if (p.avatarUrl !== undefined) update.avatar_url = p.avatarUrl;
  if (p.coverUrl !== undefined) update.cover_url = p.coverUrl;
  if (slugChangeRequested) {
    update.slug = p.slug;
    update.slug_changed_at = new Date().toISOString();
  }

  // ── Apply. When changing the slug, additionally guard slug_changed_at IS NULL
  //    so a concurrent second change can't win a race (0 rows → slug_locked). ──
  let query = supabase.schema("betk").from("stores").update(update).eq("seller_id", userId);
  if (slugChangeRequested) {
    query = query.is("slug_changed_at", null);
  }
  const { data: updated, error: updateError } = await query.select("id");

  if (updateError) {
    // R-S02 slug uniqueness (uq_stores_slug) — authoritative field-level error.
    if (updateError.code === "23505") {
      return { ok: false, reason: "slug_taken" };
    }
    captureTaggedError(updateError, "store-management", { extra: { step: "update" } });
    return { ok: false, reason: "error" };
  }

  if (slugChangeRequested && (updated?.length ?? 0) === 0) {
    // The `slug_changed_at IS NULL` guard matched nothing → the lock was spent
    // between the read and the write (race). Treat as change-once rejection.
    return { ok: false, reason: "slug_locked" };
  }

  // ── Analytics (id-only) ─────────────────────────────────────────────────────
  captureServerEvent(userId, "store_profile_updated");

  return { ok: true, slugChanged: slugChangeRequested };
}
