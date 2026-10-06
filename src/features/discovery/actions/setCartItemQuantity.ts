"use server";

/**
 * setCartItemQuantity — calls `set_cart_item_quantity`. Quantity below 1 is
 * rejected by Zod before the database call. The function does not change
 * unit_price. Remove stays the DELETE grant (T05 mounts this on P66).
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  setCartItemQuantitySchema,
  type SetCartItemQuantityInput,
  type SetCartItemQuantityResult,
} from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY, p10RefusalFromRpc } from "@/features/messaging/p10FunctionErrors";

export async function setCartItemQuantity(
  input: SetCartItemQuantityInput,
): Promise<SetCartItemQuantityResult> {
  setFeatureContext("discovery-actions");

  const parsed = setCartItemQuantitySchema.safeParse(input);
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
    captureTaggedError(err, "discovery-actions", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("betk").rpc("set_cart_item_quantity", {
    p_cart_item_id: parsed.data.cartItemId,
    p_quantity: parsed.data.quantity,
  });

  if (error) {
    const refusal = p10RefusalFromRpc(error);
    if (refusal.reason === "error") {
      captureTaggedError(error, "discovery-actions", { extra: { step: "setCartItemQuantity" } });
    }
    return refusal;
  }

  return { ok: true };
}
