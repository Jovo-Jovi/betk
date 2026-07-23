"use server";

/**
 * attachDepositProof — Phase 07 / T02b (OD-8 §5, R-S08). The BUYER attaches a
 * transfer-screenshot path (+ optional reference) to their OWN order's DEPOSIT
 * payment row. Never throws — returns a discriminated `AttachDepositProofResult`.
 *
 * WRITE PATH (REG-49 three-layer, migration 20260723140552): the buyer UPDATEs
 * only {proof_path, transfer_reference} (the column GRANT forbids everything
 * else). `enforce_payment_update` re-asserts, RAISING unless OLD.payment_type=
 * 'deposit' AND OLD.status='pending' AND the caller owns the parent order — so
 * attaching to the BALANCE row, another buyer's row, or a confirmed row is a DB
 * error, not a silent no-op. The app pre-checks here only to return clean UX
 * outcomes; the trigger is authoritative.
 *
 * PRIVATE-BUCKET DISCIPLINE (Phase-04 docs contract): `storagePath` must sit under
 * the caller's OWN auth.uid() prefix in the `docs` bucket (defense-in-depth on top
 * of the upload-time storage RLS). The path is buyer-supplied but NOT PII-adjacent
 * like national IDs; still, it is never rendered as a public URL (T03 signs it).
 *
 * IDEMPOTENT re-upload (R-S08): allowed while the deposit is status='pending'. A
 * new upload is a NEW object path (the client uploads before calling this); the
 * prior object persists in the bucket (no delete here).
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
  attachDepositProofSchema,
  type AttachDepositProofInput,
  type AttachDepositProofResult,
} from "@/validations/checkout";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

/** First path segment (the storage prefix) — must equal the caller's uid. */
function ownsPrefix(path: string, uid: string): boolean {
  return path.split("/")[0] === uid;
}

export async function attachDepositProof(
  input: AttachDepositProofInput,
): Promise<AttachDepositProofResult> {
  setFeatureContext("checkout");

  const parsed = attachDepositProofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { orderId, storagePath, transferReference } = parsed.data;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "checkout", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  // Prefix-ownership (never accept a path outside the caller's own uid prefix).
  if (!ownsPrefix(storagePath, userId)) {
    captureTaggedError(new Error("checkout: proof path outside caller prefix"), "checkout", {
      extra: { step: "prefixOwnership" },
    });
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();

  // Locate the caller's OWN order's deposit payment row (payments_access scopes to
  // the parent order's buyer; a foreign order reads zero rows → not_found).
  const { data: deposit, error: readErr } = await supabase
    .schema("betk")
    .from("payments")
    .select("id, status, order_id, orders!inner(buyer_id)")
    .eq("order_id", orderId)
    .eq("payment_type", "deposit")
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "checkout", { extra: { step: "readDeposit" } });
    return { ok: false, reason: "error" };
  }
  if (!deposit) return { ok: false, reason: "not_found" };
  const parent = deposit.orders as unknown as { buyer_id: string } | { buyer_id: string }[] | null;
  const buyerId = Array.isArray(parent) ? parent[0]?.buyer_id : parent?.buyer_id;
  if (buyerId !== userId) return { ok: false, reason: "not_found" };
  if (deposit.status !== "pending") return { ok: false, reason: "not_pending" };

  // Guarded write: only the pending deposit row; the trigger re-asserts ownership.
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("payments")
    .update({ proof_path: storagePath, transfer_reference: transferReference ?? null })
    .eq("id", deposit.id)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "checkout", { extra: { step: "attachProof" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Lost a race with an admin confirmation → the deposit is no longer pending.
    return { ok: false, reason: "not_pending" };
  }

  return { ok: true };
}
