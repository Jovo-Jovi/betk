/**
 * Shared gate for address-book writes. Zod runs in the action before this.
 * The cookie client is what `addr_self` sees. Buyer terms follow the same
 * refusal as the other buyer writes (REG-75 B).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { buyerTermsBlock } from "@/services/agreementVersions";
import { captureTaggedError } from "@/services/sentry";
import { routes } from "@/constants/routes";

type CookieClient = Awaited<ReturnType<typeof createClient>>;

export type AddressSession =
  | { ok: true; supabase: CookieClient; userId: string }
  | { ok: false; reason: "unauthenticated" | "blocked" | "error" };

export async function openAddressSession(): Promise<AddressSession> {
  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "buyer-account", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  const supabase = await createClient();
  if (await buyerTermsBlock(supabase, userId)) {
    return { ok: false, reason: "error" };
  }

  return { ok: true, supabase, userId };
}

export function revalidateAddressBook(): void {
  revalidatePath(routes.buyer.addresses);
  revalidatePath(`/en${routes.buyer.addresses}`);
}
