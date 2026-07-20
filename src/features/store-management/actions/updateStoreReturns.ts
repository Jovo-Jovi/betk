"use server";

/**
 * updateStoreReturns — Phase 04 / T07 (FR-SEL-6). Saves the seller's return
 * policy. Never throws to the client — returns a discriminated
 * `UpdateStoreReturnsResult` the form routes on.
 *
 * ATOMICITY: SINGLE-TABLE `betk.stores` UPDATE (one TEXT column) — atomically
 * fine on its own, no rpc needed.
 *
 * OWN-ROW (belt & suspenders): runs under the authenticated cookie client, so
 * `stores_manage` RLS (USING seller_id = auth.uid() OR betk.is_admin()) is the
 * authz boundary; the uid ALSO comes from the live GoTrue session and is
 * pinned into the WHERE (`.eq("seller_id", uid)`) — never a form-supplied id.
 *
 * NULL DISCIPLINE (schema: `return_policy TEXT NULL`): an empty/omitted
 * policy is written as `NULL`, never `""` — so the DB round-trips true-NULL
 * for "no policy set" and the storefront accordion (Phase-03 T06) can key its
 * empty-state off `IS NULL` rather than a blank string.
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
  updateStoreReturnsSchema,
  type UpdateStoreReturnsInput,
  type UpdateStoreReturnsResult,
} from "@/validations/storeReturns";
import type { Database } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

type StoreUpdate = Database["betk"]["Tables"]["stores"]["Update"];

export async function updateStoreReturns(
  input: UpdateStoreReturnsInput,
): Promise<UpdateStoreReturnsResult> {
  setFeatureContext("store-management");

  // ── Zod validation (before any DB call) ─────────────────────────────────────
  const parsed = updateStoreReturnsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

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
  // `.trim()` in the schema can still leave an empty string (Zod's
  // `.optional()` only permits `undefined`, it doesn't collapse `""`) — so
  // the falsy check (not just `?? null`) is required to guarantee true NULL.
  const update: StoreUpdate = { return_policy: parsed.data.returnPolicy || null };

  const { data: updated, error } = await supabase
    .schema("betk")
    .from("stores")
    .update(update)
    .eq("seller_id", userId)
    .select("id");

  if (error) {
    captureTaggedError(error, "store-management", { extra: { step: "update" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Defensive: a seller should always have a store (ADR-012 atomic submit).
    return { ok: false, reason: "no_store" };
  }

  // ── Analytics (id-only) ─────────────────────────────────────────────────────
  captureServerEvent(userId, "store_return_policy_updated");

  return { ok: true };
}
