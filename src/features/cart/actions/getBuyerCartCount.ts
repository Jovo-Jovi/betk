"use server";

/**
 * Sum of cart_items.quantity for the signed-in active buyer.
 * Null means guest, inactive, or unreadable: the top bar passes no cart props.
 * Zero is a real count (the button shows, the dot does not).
 */

import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { buyerCartCountInputSchema } from "@/validations/discovery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { asAmount } from "@/features/cart/cartRules";

export async function getBuyerCartCount(): Promise<number | null> {
  setFeatureContext("discovery-actions");

  const parsed = buyerCartCountInputSchema.safeParse({});
  if (!parsed.success) return null;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (
      err instanceof NotAuthenticatedError ||
      err instanceof UserDeactivatedError ||
      err instanceof UserNotActiveError
    ) {
      return null;
    }
    captureTaggedError(err, "discovery-actions", { extra: { step: "getBuyerCartCount.auth" } });
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("cart_items")
    .select("quantity")
    .eq("buyer_id", userId);

  if (error || !data) {
    if (error) {
      captureTaggedError(error, "discovery-actions", { extra: { step: "getBuyerCartCount" } });
    }
    return null;
  }

  return data.reduce((sum, row) => sum + asAmount(row.quantity), 0);
}
