"use server";

/**
 * sendInquiryMessage — Phase 06 / T02 (FR-BUY-5, FR-SEL-13). Either thread party
 * appends a message. Never throws — returns a discriminated
 * `SendInquiryMessageResult`.
 *
 * PARTICIPATION: server-verified via `resolveParticipant` (caller is the
 * inquiry's buyer OR the owning store) on top of the T01 RLS `inq_msg_insert`
 * (thread parties + pins sender_id = auth.uid()). An outsider → `not_found`.
 * `requireActiveUser` gates (NOT `requireVerifiedPhone`). No service-role.
 *
 * SELLER FIRST REPLY (rides here):
 *   • Status lifecycle open→replied (UI_SPEC L482): the seller's FIRST reply
 *     flips `status` open→'replied' (guarded so it never downgrades a
 *     confirmed/declined inquiry) via `inq_update` (store/admin).
 *   • avg_response_hours (DECISION 2 / Option A): recomputed for the caller's own
 *     profile on the seller's FIRST reply (recomputeSellerAvgResponseHours).
 * Both are BEST-EFFORT — the message is already sent, so a failure is logged,
 * not surfaced as a send failure.
 *
 * REG-43 (DECISION 4 — DERIVE-AT-READ): `last_message_at` is NOT written; the
 * inbox ordering derives from message sent_at (see the queries). A buyer's reply
 * therefore re-sorts the thread without any inquiries UPDATE (which a buyer
 * lacks under ERD §3 row 51 anyway).
 *
 * R-N04: capture the message event; delivery is a Phase-12 dependency.
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
  sendInquiryMessageSchema,
  type SendInquiryMessageInput,
  type SendInquiryMessageResult,
} from "@/validations/messaging";
import type { Database } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveParticipant } from "../messagingRules";
import { resolveCallerScope } from "../queries/_shared";
import { recomputeSellerAvgResponseHours } from "./_shared";

type MessageInsert = Database["betk"]["Tables"]["inquiry_messages"]["Insert"];

export async function sendInquiryMessage(
  input: SendInquiryMessageInput,
): Promise<SendInquiryMessageResult> {
  setFeatureContext("messaging");

  const parsed = sendInquiryMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { inquiryId, body } = parsed.data;

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
    .select("id, buyer_id, store_id, status")
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

  // Is this the seller's FIRST reply? (checked BEFORE the insert)
  let isSellerFirstReply = false;
  if (participant === "seller") {
    const { count } = await supabase
      .schema("betk")
      .from("inquiry_messages")
      .select("id", { count: "exact", head: true })
      .eq("inquiry_id", inquiryId)
      .eq("sender_type", "seller");
    isSellerFirstReply = (count ?? 0) === 0;
  }

  const insert: MessageInsert = {
    inquiry_id: inquiryId,
    sender_id: userId,
    sender_type: participant,
    body,
  };

  const { data: msg, error: insErr } = await supabase
    .schema("betk")
    .from("inquiry_messages")
    .insert(insert)
    .select("id")
    .single();

  if (insErr || !msg) {
    captureTaggedError(insErr ?? new Error("sendInquiryMessage: no row"), "messaging", {
      extra: { step: "insertMessage" },
    });
    return { ok: false, reason: "error" };
  }

  if (participant === "seller" && isSellerFirstReply && scope.storeId) {
    // open→replied (UI_SPEC L482); guarded so a confirmed/declined inquiry is
    // never downgraded. Best-effort.
    const { error: statusErr } = await supabase
      .schema("betk")
      .from("inquiries")
      .update({ status: "replied" })
      .eq("id", inquiryId)
      .eq("status", "open");
    if (statusErr) {
      captureTaggedError(statusErr, "messaging", { extra: { step: "flipReplied", inquiryId } });
    }

    // DECISION 2 / Option A — recompute the response metric (own profile).
    const metricErr = await recomputeSellerAvgResponseHours(supabase, userId, scope.storeId);
    if (metricErr) {
      captureTaggedError(new Error(`avg_response_hours: ${metricErr}`), "messaging", {
        extra: { step: "recomputeMetric", inquiryId },
      });
    }
  }

  // R-N04: notify the other party. Event only; delivery = Phase 12.
  captureServerEvent(userId, "inquiry_message_sent", {
    inquiry_id: inquiryId,
    sender_type: participant,
  });

  return { ok: true, messageId: msg.id };
}
