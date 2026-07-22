"use server";

/**
 * pauseListing / unpauseListing — Phase 05 / T02 (FR-SEL-8). active↔paused.
 * Never throw — return a discriminated `SetPauseResult`.
 *
 * Each is a guarded SINGLE-TABLE status UPDATE (own-store scoped: id + store_id
 * pinned + `listings_seller` RLS):
 *   • pauseListing   — status='active' → 'paused'  (guard status='active')
 *   • unpauseListing — status='paused' → 'active'  (guard status='paused')
 * A guard miss (wrong current state, or not the caller's listing) → 0 rows →
 * `invalid_state` / `not_found`. Unpause does NOT re-run the publish gate: a
 * paused listing was already published/valid, and re-gating a temporary pause
 * would be surprising (stated decision).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  listingIdInputSchema,
  type ListingIdInput,
  type SetPauseResult,
} from "@/validations/listings";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";

type Status = Database["betk"]["Enums"]["listing_status"];

async function transition(
  input: ListingIdInput,
  from: Status,
  to: Status,
  event: string,
): Promise<SetPauseResult> {
  setFeatureContext("listing");

  const parsed = listingIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId } = parsed.data;

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

  const { data: updated, error } = await supabase
    .schema("betk")
    .from("listings")
    .update({ status: to })
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .eq("status", from)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: event } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Either not the caller's listing, or not in the required source state.
    const { data: exists } = await supabase
      .schema("betk")
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("store_id", scope.storeId)
      .maybeSingle();
    return { ok: false, reason: exists ? "invalid_state" : "not_found" };
  }

  captureServerEvent(userId, event);
  return { ok: true };
}

/** active → paused. */
export async function pauseListing(input: ListingIdInput): Promise<SetPauseResult> {
  return transition(input, "active", "paused", "listing_paused");
}

/** paused → active. */
export async function unpauseListing(input: ListingIdInput): Promise<SetPauseResult> {
  return transition(input, "paused", "active", "listing_unpaused");
}
