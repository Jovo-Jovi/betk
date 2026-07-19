"use server";

/**
 * toggleFollow — Phase 03 / T06 (FR-PUB-5). Follows or unfollows a store for
 * the authenticated buyer and returns the NEW following state so the client can
 * reconcile its optimistic UI.
 *
 * SECURITY / RLS BOUNDARY (the authz boundary — no service-role, no new policy
 * added by this action): runs under the authenticated cookie client, subject to
 * the `store_follows` self-scope policies (sf_select_self / sf_insert_self /
 * sf_delete_self, ERD §3 line 45). The buyer_id is ALWAYS read from the live
 * GoTrue session — NEVER the client. wishlist/follow are NOT OD-4 transactions,
 * so requireVerifiedPhone() does NOT gate them.
 *
 * ── REG-29 (store_follows RLS restore) ──────────────────────────────────────
 * `betk.store_follows` was RLS-ENABLED with ZERO policies (default-deny for
 * everyone, incl. the owning buyer) — the ERD §3 self-scope policies were
 * SPECCED but omitted from the Phase-01 SQL contract (same class as
 * open-issue #14 / T01-FIX). Restored additively by migration
 * `20260718153021_store_follows_self_scope_rls.sql` so this action can write.
 *
 * TOGGLE + 23505: reads the caller's own row (self-scope SELECT), then flips —
 * delete if present, insert if absent. `uq_store_follow UNIQUE(buyer_id,
 * store_id)` makes a concurrent double-follow race raise Postgres 23505; we
 * treat that as idempotent success (already-followed → followed, no error
 * surface), per the T07-auth 23505 precedent.
 *
 * Guests: an unauthenticated caller is rejected with `{ ok: false,
 * reason: "unauthenticated" }` — the client routes to /auth/login?returnUrl=…
 * (locale-preserving).
 *
 * Sentry feature tag 'discovery-actions'; PostHog server events on success.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { toggleFollowInputSchema, type ToggleResult } from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** Postgres unique-violation SQLSTATE — a concurrent double-follow race. */
const PG_UNIQUE_VIOLATION = "23505";

export async function toggleFollow(storeId: string): Promise<ToggleResult> {
  setFeatureContext("discovery-actions");

  // ── Zod validation (before any DB call) ────────────────────────────────────
  const parsed = toggleFollowInputSchema.safeParse({ storeId });
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const { storeId: id } = parsed.data;

  // ── Authenticated session (buyer_id from GoTrue, never the client) ──────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, reason: "unauthenticated" };
  }

  // ── Read the caller's own row (sf_select_self) ──────────────────────────────
  const { data: existing, error: readError } = await supabase
    .schema("betk")
    .from("store_follows")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("store_id", id)
    .maybeSingle();

  if (readError) {
    captureTaggedError(readError, "discovery-actions", { extra: { step: "toggleFollow.read" } });
    return { ok: false, reason: "error" };
  }

  // ── Already following → unfollow ────────────────────────────────────────────
  if (existing) {
    const { error: deleteError } = await supabase
      .schema("betk")
      .from("store_follows")
      .delete()
      .eq("buyer_id", user.id)
      .eq("store_id", id);

    if (deleteError) {
      captureTaggedError(deleteError, "discovery-actions", { extra: { step: "toggleFollow.delete" } });
      return { ok: false, reason: "error" };
    }

    Sentry.setUser({ id: user.id });
    captureServerEvent(user.id, "store_unfollowed", { store_id: id });
    return { ok: true, active: false };
  }

  // ── Not following → follow (23505 race = idempotent "already followed") ─────
  const { error: insertError } = await supabase
    .schema("betk")
    .from("store_follows")
    .insert({ buyer_id: user.id, store_id: id });

  if (insertError && insertError.code !== PG_UNIQUE_VIOLATION) {
    captureTaggedError(insertError, "discovery-actions", { extra: { step: "toggleFollow.insert" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "store_followed", { store_id: id });
  return { ok: true, active: true };
}
