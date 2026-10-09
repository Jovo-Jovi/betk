"use server";

/**
 * Remove one cart line. DELETE stays the buyer's RLS grant (R-LOCK).
 * Zod runs before any database call. Zero rows is not-found.
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
  type RemoveCartItemResult,
} from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY } from "@/features/messaging/p10FunctionErrors";

export async function removeCartItem(input: CartItemIdInput): Promise<RemoveCartItemResult> {
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
    .delete()
    .eq("id", parsed.data.cartItemId)
    .eq("buyer_id", userId)
    .select("id");

  if (error) {
    captureTaggedError(error, "discovery-actions", { extra: { step: "removeCartItem" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }
  if (!data || data.length === 0) {
    return { ok: false, reason: "not_found", messageKey: P10_GENERIC_MESSAGE_KEY };
  }
  return { ok: true };
}
