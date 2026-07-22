"use server";

/**
 * confirmInquiry — Phase 06 / T02 (FR-SEL-13). SELLER-ONLY transition of an
 * inquiry to `status='confirmed'`. Never throws — returns a discriminated
 * `ConfirmInquiryResult`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS THE CHECKOUT-ENABLEMENT WRITE (the T01-pinned CONFIRM→CHECKOUT
 * CONTRACT). `status='confirmed'` is the member Phase 07 checkout gates
 * order-create on (AC-BUY-6: an order can only be created from a confirmed
 * inquiry). Phase 07 reads this state; it does NOT need any other flag.
 * `converted_to_order_id` is NEVER written here — Phase-07 checkout owns that
 * write (set when the confirmed inquiry becomes an order); it stays NULL through
 * all of Phase 06.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * OWNERSHIP: seller-only via the own-store pin (inquiry.store_id ===
 * caller's own store) + RLS `inq_update` (store/admin). A BUYER (who can READ
 * the inquiry via `inq_buyer`) is rejected as `not_found` here AND denied by RLS
 * — buyer-cannot-confirm holds twice. No service-role.
 *
 * IDEMPOTENT: re-confirming an already-confirmed inquiry → `{ ok: true,
 * alreadyConfirmed: true }`. A terminal state (declined/expired) → invalid_state
 * (confirm is only valid from open/replied).
 *
 * R-N04: capture the confirm event; buyer-side notification delivery = Phase 12.
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
  inquiryIdInputSchema,
  type InquiryIdInput,
  type ConfirmInquiryResult,
} from "@/validations/messaging";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerScope } from "../queries/_shared";

export async function confirmInquiry(input: InquiryIdInput): Promise<ConfirmInquiryResult> {
  setFeatureContext("messaging");

  const parsed = inquiryIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { inquiryId } = parsed.data;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "messaging", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  const supabase = await createClient();
  const scope = await resolveCallerScope(supabase);
  if (!scope) return { ok: false, reason: "unauthenticated" };

  const { data: inquiry, error: readErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .select("id, store_id, status")
    .eq("id", inquiryId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "messaging", { extra: { step: "readInquiry" } });
    return { ok: false, reason: "error" };
  }
  if (!inquiry) return { ok: false, reason: "not_found" };

  // Seller-only: the caller must own the inquiry's store (buyer-cannot-confirm).
  if (scope.storeId === null || inquiry.store_id !== scope.storeId) {
    return { ok: false, reason: "not_found" };
  }

  if (inquiry.status === "confirmed") return { ok: true, alreadyConfirmed: true };
  if (inquiry.status !== "open" && inquiry.status !== "replied") {
    return { ok: false, reason: "invalid_state" }; // declined/expired are terminal
  }

  // Guarded transition: only open/replied → confirmed (never re-write a terminal
  // state; concurrent-safe). converted_to_order_id intentionally untouched.
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .update({ status: "confirmed" })
    .eq("id", inquiryId)
    .eq("store_id", scope.storeId)
    .in("status", ["open", "replied"])
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "messaging", { extra: { step: "flipConfirmed" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    // Lost a race — re-read to distinguish already-confirmed from a terminal flip.
    const { data: after } = await supabase
      .schema("betk")
      .from("inquiries")
      .select("status")
      .eq("id", inquiryId)
      .maybeSingle();
    if (after?.status === "confirmed") return { ok: true, alreadyConfirmed: true };
    return { ok: false, reason: "invalid_state" };
  }

  // R-N04: notify the buyer that checkout is enabled. Delivery = Phase 12.
  captureServerEvent(userId, "inquiry_confirmed", { inquiry_id: inquiryId });

  return { ok: true, alreadyConfirmed: false };
}
