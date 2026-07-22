"use server";

/**
 * declineInquiry — Phase 06 / T02 (FR-SEL-13). SELLER-ONLY transition of an
 * inquiry to `status='declined'`. Never throws — returns a discriminated
 * `DeclineInquiryResult`.
 *
 * CITE-OR-OMIT (built, cited): the `inquiry_status` enum has `'declined'`
 * (T01 CONTRACT) AND `BETK_UI_SPEC.md` L481 pins a "decline action" on the
 * Seller Inbox components (L483 "Edge — decline"), so the surface is authorized.
 * (Contrast `'expired'`: UI_SPEC pins NO expire ACTION — it's a read-only
 * lifecycle state, L226 "declined/expired inquiry (read-only)" — so no
 * `expireInquiry` action is built; expiry is a system/cron concern.)
 *
 * OWNERSHIP + IDEMPOTENCY mirror confirmInquiry: seller-only via the own-store
 * pin + RLS `inq_update`; a buyer → `not_found`; re-declining → `{ ok: true,
 * alreadyDeclined: true }`; a confirmed/expired inquiry → invalid_state (decline
 * is only valid from open/replied). `converted_to_order_id` is NEVER touched.
 * No service-role.
 *
 * R-N04: capture the decline event; buyer-side notification delivery = Phase 12.
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
  type DeclineInquiryResult,
} from "@/validations/messaging";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import { resolveCallerScope } from "../queries/_shared";

export async function declineInquiry(input: InquiryIdInput): Promise<DeclineInquiryResult> {
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

  if (scope.storeId === null || inquiry.store_id !== scope.storeId) {
    return { ok: false, reason: "not_found" };
  }

  if (inquiry.status === "declined") return { ok: true, alreadyDeclined: true };
  if (inquiry.status !== "open" && inquiry.status !== "replied") {
    return { ok: false, reason: "invalid_state" }; // confirmed/expired are terminal
  }

  const { data: updated, error: updErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .update({ status: "declined" })
    .eq("id", inquiryId)
    .eq("store_id", scope.storeId)
    .in("status", ["open", "replied"])
    .select("id");

  if (updErr) {
    captureTaggedError(updErr, "messaging", { extra: { step: "flipDeclined" } });
    return { ok: false, reason: "error" };
  }
  if ((updated?.length ?? 0) === 0) {
    const { data: after } = await supabase
      .schema("betk")
      .from("inquiries")
      .select("status")
      .eq("id", inquiryId)
      .maybeSingle();
    if (after?.status === "declined") return { ok: true, alreadyDeclined: true };
    return { ok: false, reason: "invalid_state" };
  }

  // R-N04: notify the buyer of the decline. Delivery = Phase 12.
  captureServerEvent(userId, "inquiry_declined", { inquiry_id: inquiryId });

  return { ok: true, alreadyDeclined: false };
}
