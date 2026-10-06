"use server";

/**
 * addToCart — fixed-price add (R-ADD, R-C01).
 *
 * A guest has no session. The anon insert stays revoked, so the attempt
 * writes nothing and the action returns unauthenticated. A signed-in buyer
 * calls `add_fixed_cart_item`. A second line for the same listing is
 * `BETK_CART_LINE_EXISTS`; the action does not change the quantity.
 * No phone check.
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { addToCartInputSchema, type AddToCartResult } from "@/validations/discovery";
import { attemptGuestCartInsert } from "@/features/discovery/guestCart";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { P10_GENERIC_MESSAGE_KEY, p10RefusalFromRpc } from "@/features/messaging/p10FunctionErrors";

export async function addToCart(listingId: string, quantity?: number): Promise<AddToCartResult> {
  setFeatureContext("discovery-actions");

  const parsed = addToCartInputSchema.safeParse({
    listingId,
    quantity: quantity ?? 1,
  });
  if (!parsed.success) {
    return { ok: false, reason: "invalid", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const attempt = await attemptGuestCartInsert(supabase, parsed.data.listingId);
    if (attempt.rowId) {
      captureTaggedError(new Error("guest cart insert wrote a row"), "discovery-actions", {
        extra: { step: "addToCart.guest" },
      });
      return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
    }
    return { ok: false, reason: "unauthenticated", messageKey: "unauthenticated" };
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

  const { data, error } = await supabase.schema("betk").rpc("add_fixed_cart_item", {
    p_listing_id: parsed.data.listingId,
    p_quantity: parsed.data.quantity,
  });

  if (error || !data) {
    if (error) {
      const refusal = p10RefusalFromRpc(error);
      if (refusal.reason === "error") {
        captureTaggedError(error, "discovery-actions", { extra: { step: "addToCart" } });
      }
      return refusal;
    }
    captureTaggedError(new Error("addToCart: no row"), "discovery-actions", {
      extra: { step: "addToCart" },
    });
    return { ok: false, reason: "error", messageKey: P10_GENERIC_MESSAGE_KEY };
  }

  return { ok: true, cartItemId: data };
}
