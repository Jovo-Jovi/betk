"use server";

/**
 * setListingSoldOut — P32. Flips an owning seller's listing between active
 * and sold_out, and writes nothing else. F-P1 does not treat that transition
 * as a publish. Never throws. A database refusal is a code, not the
 * Postgres sentence.
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
  setListingSoldOutSchema,
  type SetListingSoldOutInput,
  type SetListingSoldOutResult,
} from "@/validations/listings";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerStoreId } from "../queries/_shared";
import { refusalFromDb } from "./_shared";

export async function setListingSoldOut(
  input: SetListingSoldOutInput,
): Promise<SetListingSoldOutResult> {
  setFeatureContext("listing");

  const parsed = setListingSoldOutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { listingId, soldOut } = parsed.data;

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

  const from = soldOut ? "active" : "sold_out";
  const to = soldOut ? "sold_out" : "active";

  const { data: updated, error } = await supabase
    .schema("betk")
    .from("listings")
    .update({ status: to })
    .eq("id", listingId)
    .eq("store_id", scope.storeId)
    .eq("status", from)
    .select("id");

  if (error) {
    captureTaggedError(error, "listing", { extra: { step: "setListingSoldOut" } });
    return refusalFromDb(error.message);
  }
  if ((updated?.length ?? 0) === 0) {
    const { data: exists } = await supabase
      .schema("betk")
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("store_id", scope.storeId)
      .maybeSingle();
    return { ok: false, reason: exists ? "invalid_state" : "not_found" };
  }

  captureServerEvent(userId, soldOut ? "listing_sold_out" : "listing_available");
  return { ok: true };
}
