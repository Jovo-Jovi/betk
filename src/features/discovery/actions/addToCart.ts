"use server";

/**
 * addToCart — guest refusal (R-C01). Phase 10 owns the authenticated cart write.
 *
 * A guest attempt runs as the cookie client with no session (anon). The insert
 * is revoked from anon. The action returns unauthenticated so the page sends
 * the guest to login. It does not insert for an authenticated buyer.
 */

import { createClient } from "@/lib/supabase/server";
import { addToCartInputSchema, type AddToCartResult } from "@/validations/discovery";
import { attemptGuestCartInsert } from "@/features/discovery/guestCart";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

export async function addToCart(listingId: string): Promise<AddToCartResult> {
  setFeatureContext("discovery-actions");

  const parsed = addToCartInputSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!authError && user) {
    return { ok: false, reason: "unavailable" };
  }

  const attempt = await attemptGuestCartInsert(supabase, parsed.data.listingId);
  if (attempt.rowId) {
    captureTaggedError(new Error("guest cart insert wrote a row"), "discovery-actions", {
      extra: { step: "addToCart.guest" },
    });
    return { ok: false, reason: "error" };
  }

  return { ok: false, reason: "unauthenticated" };
}
