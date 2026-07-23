"use server";

/**
 * markOrderPreparing — Phase 07 / T02b. The SELLER moves confirmed→preparing on
 * their OWN store's order. Never throws — returns `MarkOrderPreparingResult`.
 *
 * WRITE PATH (REG-49 three-layer): the seller UPDATEs only `status`;
 * `enforce_order_transition` admits confirmed→preparing for the owning store only
 * (SUB-DECISION A) and RAISEs otherwise. Idempotent: already-preparing → { ok:
 * true, alreadyPreparing: true }.
 *
 * Phase-08 owns everything downstream of preparing (dispatched/delivered/returned +
 * shipment writes) — cite BETK_PHASES; those transitions are NOT admitted here.
 *
 * R-N04: no buyer-facing notification is specced for this internal fulfilment step;
 * no event emitted (delivery/notifications are Phase 12 regardless).
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
  orderIdInputSchema,
  type OrderIdInput,
  type MarkOrderPreparingResult,
} from "@/validations/orders";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { resolveCallerScope } from "../queries/_shared";

export async function markOrderPreparing(input: OrderIdInput): Promise<MarkOrderPreparingResult> {
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

  const scope = await resolveCallerScope(supabase);
  if (!scope) return { ok: false, reason: "unauthenticated" };
  if (scope.storeId === null) return { ok: false, reason: "not_found" };

  const { data: order, error: readErr } = await supabase
    .schema("betk")
    .from("orders")
    .select("id, store_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "orders", { extra: { step: "readOrder" } });
    return { ok: false, reason: "error" };
  }
  if (!order || order.store_id !== scope.storeId) return { ok: false, reason: "not_found" };
  if (order.status === "preparing") return { ok: true, alreadyPreparing: true };
  if (order.status !== "confirmed") return { ok: false, reason: "invalid_state" };

  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("orders")
    .update({ status: "preparing" })
    .eq("id", orderId)
    .eq("store_id", scope.storeId)
    .eq("status", "confirmed")
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "orders", { extra: { step: "preparingTransition" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    const { data: after } = await supabase
      .schema("betk")
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if (after?.status === "preparing") return { ok: true, alreadyPreparing: true };
    return { ok: false, reason: "invalid_state" };
  }

  const { error: histErr } = await supabase
    .schema("betk")
    .from("order_status_history")
    .insert({
      order_id: orderId,
      from_status: "confirmed",
      to_status: "preparing",
      changed_by: userId,
      changed_by_type: "seller",
      notes: "order marked preparing by seller",
    });
  if (histErr) captureTaggedError(histErr, "orders", { extra: { step: "statusHistory" } });

  return { ok: true, alreadyPreparing: false };
}
