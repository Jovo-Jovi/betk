"use server";

/**
 * R-NEWQUOTE. A custom line blocked by quote_expired is removed with the
 * existing RLS DELETE, then the caller opens the inquiry thread.
 * send_inquiry_quote is never called: it raises BETK_QUOTE_LINE_HELD
 * while a cart line still holds the quote (R-FREEZE).
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  cartItemIdInputSchema,
  type CartItemIdInput,
  type ReleaseHeldQuoteLineResult,
} from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY } from "@/features/messaging/p10FunctionErrors";
import { customQuoteExpired, firstEmbed } from "@/features/cart/cartRules";

interface HeldLine {
  id: string;
  is_custom: boolean;
  inquiry_id: string | null;
  inquiries:
    | { quote_expires_at: string | null }
    | { quote_expires_at: string | null }[]
    | null;
}

export async function releaseHeldQuoteLine(
  input: CartItemIdInput,
): Promise<ReleaseHeldQuoteLineResult> {
  setFeatureContext("discovery-actions");

  const parsed = cartItemIdInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, reason: "unauthenticated", messageKey: "unauthenticated" };
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked", messageKey: P10_GENERIC_MESSAGE_KEY };
    }
    captureTaggedError(err, "discovery-actions", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("cart_items")
    .select("id, is_custom, inquiry_id, inquiries(quote_expires_at)")
    .eq("id", parsed.data.cartItemId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (error) {
    captureTaggedError(error, "discovery-actions", { extra: { step: "releaseHeldQuoteLine.read" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const line = data as HeldLine | null;
  if (!line || !line.is_custom || !line.inquiry_id) {
    return { ok: false, reason: "refused", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const inquiry = firstEmbed(line.inquiries);
  const expired = inquiry == null || customQuoteExpired(inquiry.quote_expires_at, new Date());
  if (!expired) {
    return { ok: false, reason: "refused", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const { data: removed, error: deleteError } = await supabase
    .schema("betk")
    .from("cart_items")
    .delete()
    .eq("id", parsed.data.cartItemId)
    .eq("buyer_id", userId)
    .select("id");

  if (deleteError) {
    captureTaggedError(deleteError, "discovery-actions", { extra: { step: "releaseHeldQuoteLine.delete" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }
  if (!removed || removed.length === 0) {
    return { ok: false, reason: "not_found", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  return { ok: true, inquiryId: line.inquiry_id };
}
