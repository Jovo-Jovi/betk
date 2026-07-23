"use server";

/**
 * confirmDepositPayment — Phase 07 / T02b (OD-8 §5, AC-SEL-14 upstream). The ADMIN
 * (BETK, custodial — NEVER the seller) verifies a buyer's deposit transfer and
 * flips the DEPOSIT payment row to `confirmed`. Never throws — returns
 * `ConfirmDepositPaymentResult`.
 *
 * GATE: requireAdmin() — the canonical app-mirror of DB `betk.is_admin()` (role ∈
 * {admin,superadmin} AND status='active'). It is NOT a second source of truth; the
 * payments UPDATE trigger `enforce_payment_update` re-asserts is_admin() AND the
 * F2 transition (pending→confirmed ONLY) authoritatively.
 *
 * WRITE PATH (REG-49 three-layer): admin UPDATEs {status, confirmed_by,
 * confirmed_at}. F2 rejects any status change other than pending→confirmed (a
 * confirmed→pending flip or a →refunded/→failed RAISEs BETK_ILLEGAL_PAYMENT_-
 * TRANSITION; refunded/failed are Phase 10/14). Idempotent: an already-confirmed
 * deposit returns { ok: true, alreadyConfirmed: true } WITHOUT re-writing.
 *
 * MODERATION LOG (deliberately NOT written — FLAGGED): the modlog_admin_insert
 * policy IS landed this migration (REG-68), but `moderation_logs.target_type` is
 * the `moderation_target` enum = {seller,buyer,listing,review,dispute,payout} —
 * it has NO `payment`/`order` member. A deposit confirmation is a custodial
 * payment action, not a moderation action against a person/listing; forcing
 * target_type='buyer'/'payout' would be a semantic lie that pollutes the audit
 * surface. So NO row is written here. A payment-audit mechanism (a widened enum or
 * a dedicated payment-audit table) is a human-authorized decision, out of T02b
 * scope. The policy is landed for the Phase-10/14 moderation writers that DO fit
 * the enum.
 *
 * R-N04: capture "deposit_confirmed" (the buyer + seller are notified — delivery
 * is Phase 12; NO notifications-table write / send here).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireAdmin,
  NotAdminError,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  paymentIdInputSchema,
  type PaymentIdInput,
  type ConfirmDepositPaymentResult,
} from "@/validations/orders";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

export async function confirmDepositPayment(
  input: PaymentIdInput,
): Promise<ConfirmDepositPaymentResult> {
  setFeatureContext("orders");

  const parsed = paymentIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { paymentId } = parsed.data;

  let adminId: string;
  try {
    const admin = await requireAdmin();
    adminId = admin.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (
      err instanceof NotAdminError ||
      err instanceof UserDeactivatedError ||
      err instanceof UserNotActiveError
    ) {
      return { ok: false, reason: "forbidden" };
    }
    captureTaggedError(err, "orders", { extra: { step: "requireAdmin" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: adminId });
  const supabase = await createClient();

  // Admin reads any payment (payments_access is_admin branch).
  const { data: payment, error: readErr } = await supabase
    .schema("betk")
    .from("payments")
    .select("id, status, payment_type, order_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "orders", { extra: { step: "readPayment" } });
    return { ok: false, reason: "error" };
  }
  if (!payment) return { ok: false, reason: "not_found" };
  if (payment.payment_type !== "deposit") return { ok: false, reason: "invalid_state" };
  if (payment.status === "confirmed") return { ok: true, alreadyConfirmed: true };
  if (payment.status !== "pending") return { ok: false, reason: "invalid_state" }; // failed/refunded

  // Guarded transition (concurrent-safe): pending → confirmed only. The trigger
  // re-asserts is_admin() + F2.
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_by: adminId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "orders", { extra: { step: "confirmDeposit" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    const { data: after } = await supabase
      .schema("betk")
      .from("payments")
      .select("status")
      .eq("id", paymentId)
      .maybeSingle();
    if (after?.status === "confirmed") return { ok: true, alreadyConfirmed: true };
    return { ok: false, reason: "invalid_state" };
  }

  // R-N04: notify buyer (deposit verified) + seller (order ready to accept). Phase 12.
  captureServerEvent(adminId, "deposit_confirmed", { order_id: payment.order_id, payment_id: paymentId });

  return { ok: true, alreadyConfirmed: false };
}
