"use server";

/**
 * setDefaultAddress — one statement over the caller's own rows.
 * See `assignSingleDefault`. Never two sequential default writes.
 */

import * as Sentry from "@sentry/nextjs";
import { assignSingleDefault } from "@/features/buyer-account/assignSingleDefault";
import { openAddressSession, revalidateAddressBook } from "@/features/buyer-account/addressSession";
import {
  addressIdSchema,
  type AddressIdInput,
  type AddressMutationResult,
} from "@/validations/address";
import { setFeatureContext } from "@/services/sentry";

export async function setDefaultAddress(input: AddressIdInput): Promise<AddressMutationResult> {
  setFeatureContext("buyer-account");

  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const session = await openAddressSession();
  if (!session.ok) return session;

  const { supabase, userId } = session;
  Sentry.setUser({ id: userId });

  const assigned = await assignSingleDefault(supabase, userId, parsed.data.id);
  if (!assigned.ok) {
    return { ok: false, reason: assigned.reason === "not_found" ? "not_found" : "error" };
  }

  revalidateAddressBook();
  return { ok: true };
}
