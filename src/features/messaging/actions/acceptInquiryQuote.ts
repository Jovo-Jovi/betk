"use server";

/**
 * acceptInquiryQuote — P14. Calls `accept_inquiry_quote`. One custom cart
 * line at the quoted price, or a refusal. No phone check. No checkout.
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  inquiryIdInputSchema,
  type AcceptInquiryQuoteResult,
  type InquiryIdInput,
} from "@/validations/messaging";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY, p10RefusalFromRpc } from "../p10FunctionErrors";

export async function acceptInquiryQuote(
  input: InquiryIdInput,
): Promise<AcceptInquiryQuoteResult> {
  setFeatureContext("messaging");

  const parsed = inquiryIdInputSchema.safeParse(input);
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
  const { data, error } = await supabase.schema("betk").rpc("accept_inquiry_quote", {
    p_inquiry_id: parsed.data.inquiryId,
  });

  if (error || !data) {
    if (error) {
      const refusal = p10RefusalFromRpc(error);
      if (refusal.reason === "error") {
        captureTaggedError(error, "messaging", { extra: { step: "acceptInquiryQuote" } });
      }
      return refusal;
    }
    captureTaggedError(new Error("acceptInquiryQuote: no row"), "messaging", {
      extra: { step: "acceptInquiryQuote" },
    });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  return { ok: true, cartItemId: data };
}
