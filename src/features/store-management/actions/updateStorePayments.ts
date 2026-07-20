"use server";

/**
 * updateStorePayments — Phase 04 / T07 (FR-SEL-7 / R-S09 config). Saves the
 * seller's payment-method handles. Never throws to the client — returns a
 * discriminated `UpdateStorePaymentsResult` the form routes on.
 *
 * ATOMICITY: SINGLE-TABLE `betk.stores` UPDATE (one JSONB column) — atomically
 * fine on its own, no rpc needed.
 *
 * OWN-ROW (belt & suspenders): runs under the authenticated cookie client, so
 * `stores_manage` RLS (USING seller_id = auth.uid() OR betk.is_admin()) is the
 * authz boundary; the uid ALSO comes from the live GoTrue session and is
 * pinned into the WHERE (`.eq("seller_id", uid)`) — never a form-supplied id.
 *
 * SHAPE: the Zod schema is the SAME `storePaymentMethodsSchema` T03/T04
 * validate against — the typed `StorePaymentMethods` is consumed as-is and
 * written verbatim, never reshaped.
 *
 * R-S09 (≥1 method required to PUBLISH a listing): this action is CONFIG
 * ONLY — it never blocks a save with zero methods set. The enforcement point
 * is the Phase-05 listing-publish gate, not this action (see the banner
 * comment in the form component for the same note at the UI layer).
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
  updateStorePaymentsSchema,
  type UpdateStorePaymentsInput,
  type UpdateStorePaymentsResult,
} from "@/validations/storePayments";
import type { Database } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

type StoreUpdate = Database["betk"]["Tables"]["stores"]["Update"];

export async function updateStorePayments(
  input: UpdateStorePaymentsInput,
): Promise<UpdateStorePaymentsResult> {
  setFeatureContext("store-management");

  // ── Zod validation (before any DB call) ─────────────────────────────────────
  const parsed = updateStorePaymentsSchema.safeParse(input);
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
  const update: StoreUpdate = { payment_methods: parsed.data };

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
  captureServerEvent(userId, "store_payment_methods_updated");

  return { ok: true };
}
