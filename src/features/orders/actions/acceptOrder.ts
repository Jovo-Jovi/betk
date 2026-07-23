"use server";

/**
 * acceptOrder — Phase 07 / T02b (AC-SEL-14, R-L05/R-L06). The SELLER accepts
 * (pending→confirmed) an order on their OWN store. Never throws — returns
 * `AcceptOrderResult`.
 *
 * CUSTODIAL GATE (AC-SEL-14, DB-authoritative): a seller may accept ONLY after
 * BETK has confirmed the deposit. `enforce_order_transition` RAISEs
 * BETK_DEPOSIT_UNCONFIRMED unless the order's deposit payment row is
 * status='confirmed'. The app pre-check here (`deposit_unconfirmed`) is UX-only —
 * REG-33's lesson: the trigger, not the app, is the authority.
 *
 * STOCK (R-L05/R-L06, DB-authoritative): the acceptance is what decrements stock,
 * NOT checkout. The AFTER UPDATE `decrement_stock_on_confirm` trigger fires on the
 * pending→confirmed flip, decrements each tracked listing's stock_qty by the
 * ordered quantity, and flips active→sold_out at 0. The listings CHECK
 * (stock_qty >= 0) is the oversell guard: an accept that would drive stock
 * negative RAISEs (23514) and rolls the WHOLE accept back (no partial confirm) →
 * typed `out_of_stock`. Untracked stock (NULL) is unaffected.
 *
 * WRITE PATH (REG-49 three-layer): the seller UPDATEs only `status`; the trigger
 * validates store-ownership (SUB-DECISION A: store-only) + the deposit gate and
 * stamps confirmed_at. Idempotent: an already-confirmed order → { ok: true,
 * alreadyConfirmed: true }.
 *
 * R-N04: capture "order_accepted" (buyer notified — delivery is Phase 12).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { orderIdInputSchema, type OrderIdInput, type AcceptOrderResult } from "@/validations/orders";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerScope } from "../queries/_shared";

export async function acceptOrder(input: OrderIdInput): Promise<AcceptOrderResult> {
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
  if (scope.storeId === null) return { ok: false, reason: "not_found" }; // not a seller w/ store

  // Own-store order only (a buyer/other seller reading via orders_access is filtered
  // out by the store pin → not_found).
  const { data: order, error: readErr } = await supabase
    .schema("betk")
    .from("orders")
    .select("id, store_id, status, payments!inner(payment_type, status)")
    .eq("id", orderId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "orders", { extra: { step: "readOrder" } });
    return { ok: false, reason: "error" };
  }
  if (!order || order.store_id !== scope.storeId) return { ok: false, reason: "not_found" };
  if (order.status === "confirmed") return { ok: true, alreadyConfirmed: true };
  if (order.status !== "pending") return { ok: false, reason: "invalid_state" };

  // UX pre-check of the custodial gate (the trigger is authoritative).
  const paymentRows = (order.payments ?? []) as unknown as {
    payment_type: string;
    status: string;
  }[];
  const depositConfirmed = paymentRows.some(
    (p) => p.payment_type === "deposit" && p.status === "confirmed",
  );
  if (!depositConfirmed) return { ok: false, reason: "deposit_unconfirmed" };

  // Guarded transition (concurrent-safe): pending → confirmed, own store. The
  // BEFORE trigger re-checks store + deposit; the AFTER trigger decrements stock.
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("orders")
    .update({ status: "confirmed" })
    .eq("id", orderId)
    .eq("store_id", scope.storeId)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    const msg = updErr.message ?? "";
    if (msg.includes("BETK_DEPOSIT_UNCONFIRMED")) return { ok: false, reason: "deposit_unconfirmed" };
    // Oversell: the listings CHECK (stock_qty >= 0) rolled the whole accept back.
    if (updErr.code === "23514" || msg.includes("stock_qty")) {
      return { ok: false, reason: "out_of_stock" };
    }
    captureTaggedError(updErr, "orders", { extra: { step: "acceptTransition" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    const { data: after } = await supabase
      .schema("betk")
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if (after?.status === "confirmed") return { ok: true, alreadyConfirmed: true };
    return { ok: false, reason: "invalid_state" };
  }

  const { error: histErr } = await supabase
    .schema("betk")
    .from("order_status_history")
    .insert({
      order_id: orderId,
      from_status: "pending",
      to_status: "confirmed",
      changed_by: userId,
      changed_by_type: "seller",
      notes: "order accepted by seller",
    });
  if (histErr) captureTaggedError(histErr, "orders", { extra: { step: "statusHistory" } });

  // R-N04: buyer notified their order is confirmed. Delivery = Phase 12.
  captureServerEvent(userId, "order_accepted", { order_id: orderId });

  return { ok: true, alreadyConfirmed: false };
}
