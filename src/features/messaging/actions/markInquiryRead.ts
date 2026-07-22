"use server";

/**
 * markInquiryRead — Phase 06 / T02-FIX (FR-BUY-5, FR-SEL-13). The RECEIVER marks
 * the OTHER party's messages in an inquiry as read. Never throws — returns a
 * discriminated `MarkInquiryReadResult`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * REG-42 CLOSED (was: DECISION 3(a) DEFER — now SUPERSEDED by the authorized
 * ERD §3 row-52 amendment, 2026-07-22). The unread mechanism is
 * `inquiry_messages.is_read` (BOOLEAN NOT NULL DEFAULT false). is_read is
 * DEFINITIONALLY receiver-driven: the party who did NOT send a message is the
 * one who reads it. The write is authorized by:
 *   • the migration 20260722124510 RECEIVER policy `inq_msg_read_receipt`
 *     (thread-party AND sender_id <> auth.uid()), OR-combined with the pre-existing
 *     sender policy `inq_msg_update`; AND
 *   • the column-level GRANT re-scope — authenticated may UPDATE ONLY the is_read
 *     column, so this action can NEVER touch `body`/content (defence in depth; a
 *     content edit is denied by the GRANT, not merely filtered to zero rows).
 * NO service-role. `requireActiveUser` gates (NOT `requireVerifiedPhone` —
 * inquiries are pre-transaction).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PARTICIPATION: server-verified via `resolveParticipant` (caller is the
 * inquiry's buyer OR the owning store) on top of the RLS thread scope. An
 * OUTSIDER → `not_found` (distinguished from the idempotent zero-row case, which
 * is `{ ok: true, markedCount: 0 }`).
 *
 * IDEMPOTENT: re-marking an already-read thread flips zero rows and still returns
 * `{ ok: true, markedCount: 0 }` — zero rows is NOT an error.
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
  type MarkInquiryReadResult,
} from "@/validations/messaging";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { resolveParticipant } from "../messagingRules";
import { resolveCallerScope } from "../queries/_shared";

export async function markInquiryRead(input: InquiryIdInput): Promise<MarkInquiryReadResult> {
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

  // Load the inquiry (RLS returns it only to the buyer / owning store / admin).
  const { data: inquiry, error: readErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .select("id, buyer_id, store_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (readErr) {
    if (readErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(readErr, "messaging", { extra: { step: "readInquiry" } });
    return { ok: false, reason: "error" };
  }
  if (!inquiry) return { ok: false, reason: "not_found" };

  const participant = resolveParticipant(
    { buyerId: inquiry.buyer_id, storeId: inquiry.store_id },
    { userId, storeId: scope.storeId },
  );
  if (!participant) return { ok: false, reason: "not_found" };

  // Flip is_read on the OTHER party's still-unread messages. Column-confined to
  // is_read by the GRANT; row-authorized by inq_msg_read_receipt (sender <> caller).
  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("inquiry_messages")
    .update({ is_read: true })
    .eq("inquiry_id", inquiryId)
    .neq("sender_id", userId)
    .eq("is_read", false)
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "messaging", { extra: { step: "markRead", inquiryId } });
    return { ok: false, reason: "error" };
  }

  return { ok: true, markedCount: updated?.length ?? 0 };
}
