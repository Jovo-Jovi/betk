"use server";

/**
 * toggleWishlist — Phase 03 / T06 (FR-PUB-4/5). Adds or removes a listing from
 * the authenticated buyer's wishlist and returns the NEW saved state so the
 * client can reconcile its optimistic UI.
 *
 * SECURITY / RLS BOUNDARY (the authz boundary — no service-role, no new policy):
 *   Runs under the authenticated cookie client, so every read/write is subject
 *   to `wishlist_own` (PERMISSIVE FOR ALL USING buyer_id = auth.uid() OR
 *   betk.is_admin()). The buyer_id is ALWAYS read from the live GoTrue session
 *   (`supabase.auth.getUser()`) — NEVER from the client — so a caller can only
 *   ever touch their own rows; RLS is what enforces that, not app code.
 *   wishlist/follow are NOT OD-4 transactions, so requireVerifiedPhone() does
 *   NOT gate them.
 *
 * TOGGLE + 23505: reads the caller's own row (self-scope SELECT), then flips —
 * delete if present, insert if absent. `uq_wishlist UNIQUE(buyer_id, listing_id)`
 * makes a concurrent double-add race raise Postgres 23505; we treat that as
 * idempotent success ("already saved" → saved), never surfacing an error, per
 * the T07-auth 23505 precedent (verifyPhoneOtp's uq_users_phone catch).
 *
 * Guests: an unauthenticated caller is rejected with `{ ok: false,
 * reason: "unauthenticated" }` — the client routes to /auth/login?returnUrl=…
 * (locale-preserving). Never throws for the auth case.
 *
 * Sentry feature tag 'discovery-actions'; PostHog server events on success.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { toggleWishlistInputSchema, type ToggleResult } from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** Postgres unique-violation SQLSTATE — a concurrent double-insert race. */
const PG_UNIQUE_VIOLATION = "23505";

export async function toggleWishlist(listingId: string): Promise<ToggleResult> {
  setFeatureContext("discovery-actions");

  // ── Zod validation (before any DB call) ────────────────────────────────────
  const parsed = toggleWishlistInputSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const { listingId: id } = parsed.data;

  // ── Authenticated session (buyer_id from GoTrue, never the client) ──────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // ── Read the caller's own row (wishlist_own self-scope SELECT) ──────────────
  const { data: existing, error: readError } = await supabase
    .schema("betk")
    .from("wishlists")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("listing_id", id)
    .maybeSingle();

  if (readError) {
    captureTaggedError(readError, "discovery-actions", { extra: { step: "toggleWishlist.read" } });
    return { ok: false, reason: "error" };
  }

  // ── Already saved → remove ──────────────────────────────────────────────────
  if (existing) {
    const { error: deleteError } = await supabase
      .schema("betk")
      .from("wishlists")
      .delete()
      .eq("buyer_id", user.id)
      .eq("listing_id", id);

    if (deleteError) {
      captureTaggedError(deleteError, "discovery-actions", { extra: { step: "toggleWishlist.delete" } });
      return { ok: false, reason: "error" };
    }

    Sentry.setUser({ id: user.id });
    captureServerEvent(user.id, "wishlist_removed", { listing_id: id });
    return { ok: true, active: false };
  }

  // ── Not saved → add (23505 concurrent race = idempotent "already saved") ────
  const { error: insertError } = await supabase
    .schema("betk")
    .from("wishlists")
    .insert({ buyer_id: user.id, listing_id: id });

  if (insertError && insertError.code !== PG_UNIQUE_VIOLATION) {
    captureTaggedError(insertError, "discovery-actions", { extra: { step: "toggleWishlist.insert" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "wishlist_added", { listing_id: id });
  return { ok: true, active: true };
}
