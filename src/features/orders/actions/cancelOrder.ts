"use server";

/**
 * cancelOrder — Phase 07 / T02b (R-O03). The BUYER cancels their OWN order, and
 * ONLY while it is still `pending`. Never throws — returns `CancelOrderResult`.
 *
 * WRITE PATH (REG-49 three-layer, migration 20260723140552): the buyer UPDATEs
 * only `status` (the column GRANT is status + cancellation_reason; cancelled_by is
 * NOT grantable — F1). `enforce_order_transition` validates the transition
 * (pending→cancelled, buyer-only — SUB-DECISION A) and STAMPS `cancelled_by =
 * 'buyer'` server-side; the client never supplies it. A cancel from any non-pending
 * state RAISEs BETK_NOT_CANCELLABLE — the app pre-check here only yields the clean
 * `not_cancellable` UX outcome; the trigger is authoritative.
 *
 * cancellation_reason: T02b collects NO buyer-facing reason (the T04 cancel is a
 * bare ConfirmDialog, no free-text field in scope), so it is left NULL. The actor
 * + intent are recorded in the append-only order_status_history row (changed_by +
 * changed_by_type='buyer'). When/if a reason UI is specced, add it to the schema
 * and write it here (the GRANT already permits it).
 *
 * R-N04: no notification write/send here (Phase 12 owns delivery); this transition
 * is buyer-initiated so there is no buyer-facing event to emit.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { orderIdInputSchema, type OrderIdInput, type CancelOrderResult } from "@/validations/orders";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

export async function cancelOrder(input: OrderIdInput): Promise<CancelOrderResult> {
  setFeatureContext("orders");

  const parsed = orderIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { orderId } = parsed.data;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "orders", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });
  const supabase = await createClient();

  // Own order only (a seller who can READ their store's order via orders_access is
  // not the buyer → not_found; cancel is buyer-only, R-O03).
  const { data: order, error: readErr } = await supabase
    .schema("betk")
    .from("orders")
    .select("id, buyer_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "orders", { extra: { step: "readOrder" } });
    return { ok: false, reason: "error" };
  }
  if (!order || order.buyer_id !== userId) return { ok: false, reason: "not_found" };
  if (order.status !== "pending") return { ok: false, reason: "not_cancellable" };

  // Guarded transition (concurrent-safe): only pending → cancelled, own row. The
  // trigger stamps cancelled_by='buyer'.
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "orders", { extra: { step: "cancelTransition" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Lost a race — re-read to distinguish already-cancelled from a later state.
    const { data: after } = await supabase
      .schema("betk")
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if (after?.status === "cancelled") return { ok: true };
    return { ok: false, reason: "not_cancellable" };
  }

  // Append-only audit row (order_status_history_insert: buyer of parent order).
  const { error: histErr } = await supabase
    .schema("betk")
    .from("order_status_history")
    .insert({
      order_id: orderId,
      from_status: "pending",
      to_status: "cancelled",
      changed_by: userId,
      changed_by_type: "buyer",
      notes: "order cancelled by buyer",
    });
  if (histErr) {
    // The transition already committed; a history-log miss must not fail the
    // action (append-only best-effort). Capture for observability.
    captureTaggedError(histErr, "orders", { extra: { step: "statusHistory" } });
  }

  return { ok: true };
}
