"use server";

/**
 * deleteAddress — remove one of the caller's addresses under `addr_self`.
 *
 * Deleting the default does not pick another row. The page then shows that
 * there is no default. A row referenced by `master_orders.delivery_address_id`
 * (no ON DELETE clause, so RESTRICT) comes back as `in_use`.
 */

import * as Sentry from "@sentry/nextjs";
import { openAddressSession, revalidateAddressBook } from "@/features/buyer-account/addressSession";
import {
  addressIdSchema,
  type AddressIdInput,
  type AddressMutationResult,
} from "@/validations/address";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

const FK_VIOLATION = "23503";

export async function deleteAddress(input: AddressIdInput): Promise<AddressMutationResult> {
  setFeatureContext("buyer-account");

  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const session = await openAddressSession();
  if (!session.ok) return session;

  const { supabase, userId } = session;
  Sentry.setUser({ id: userId });

  const deleted = await supabase
    .schema("betk")
    .from("addresses")
    .delete()
    .eq("id", parsed.data.id)
    .eq("buyer_id", userId)
    .select("id");

  if (deleted.error) {
    if (deleted.error.code === FK_VIOLATION) return { ok: false, reason: "in_use" };
    captureTaggedError(deleted.error, "buyer-account", { extra: { step: "delete" } });
    return { ok: false, reason: "error" };
  }
  if ((deleted.data ?? []).length === 0) return { ok: false, reason: "not_found" };

  revalidateAddressBook();
  return { ok: true };
}
