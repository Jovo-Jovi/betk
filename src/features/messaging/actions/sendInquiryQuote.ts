"use server";

/**
 * sendInquiryQuote — P37. Calls `send_inquiry_quote`. The function owns the
 * band, the prep check, eligibility, and the validity hours. This action
 * does not hard-code those settings and does not check a phone number.
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  sendInquiryQuoteSchema,
  type SendInquiryQuoteInput,
  type SendInquiryQuoteResult,
} from "@/validations/messaging";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY, p10RefusalFromRpc } from "../p10FunctionErrors";

export async function sendInquiryQuote(
  input: SendInquiryQuoteInput,
): Promise<SendInquiryQuoteResult> {
  setFeatureContext("messaging");

  const parsed = sendInquiryQuoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  try {
    await requireActiveUser();
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, reason: "unauthenticated", messageKey: "unauthenticated" };
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked", messageKey: P10_GENERIC_MESSAGE_KEY };
    }
    captureTaggedError(err, "messaging", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("betk").rpc("send_inquiry_quote", {
    p_inquiry_id: parsed.data.inquiryId,
    p_quoted_price: parsed.data.quotedPrice,
    p_prep_days: parsed.data.prepDays,
  });

  if (error) {
    const refusal = p10RefusalFromRpc(error);
    if (refusal.reason === "error") {
      captureTaggedError(error, "messaging", { extra: { step: "sendInquiryQuote" } });
    }
    return refusal;
  }

  return { ok: true };
}
