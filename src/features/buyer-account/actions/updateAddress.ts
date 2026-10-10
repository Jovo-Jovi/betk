"use server";

/**
 * updateAddress — edit one of the caller's addresses under `addr_self`.
 *
 * The column update does not touch `is_default`. When `makeDefault` is set,
 * the field change and the single-default flip are the one upsert in
 * `assignSingleDefault`, not a field update followed by a second write.
 */

import * as Sentry from "@sentry/nextjs";
import { assignSingleDefault } from "@/features/buyer-account/assignSingleDefault";
import { blankToNull } from "@/features/buyer-account/addressValues";
import { openAddressSession, revalidateAddressBook } from "@/features/buyer-account/addressSession";
import {
  updateAddressSchema,
  type UpdateAddressInput,
  type AddressMutationResult,
} from "@/validations/address";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

export async function updateAddress(input: UpdateAddressInput): Promise<AddressMutationResult> {
  setFeatureContext("buyer-account");

  const parsed = updateAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const p = parsed.data;

  const session = await openAddressSession();
  if (!session.ok) return session;

  const { supabase, userId } = session;
  Sentry.setUser({ id: userId });

  const fields = {
    label: blankToNull(p.label),
    governorate: p.governorate,
    city: p.city,
    street_address: p.streetAddress,
    building_notes: blankToNull(p.buildingNotes),
  };

  if (p.makeDefault) {
    const assigned = await assignSingleDefault(supabase, userId, p.id, fields);
    if (!assigned.ok) {
      return { ok: false, reason: assigned.reason === "not_found" ? "not_found" : "error" };
    }
    revalidateAddressBook();
    return { ok: true };
  }

  const updated = await supabase
    .schema("betk")
    .from("addresses")
    .update(fields)
    .eq("id", p.id)
    .eq("buyer_id", userId)
    .select("id");

  if (updated.error) {
    captureTaggedError(updated.error, "buyer-account", { extra: { step: "update" } });
    return { ok: false, reason: "error" };
  }
  if ((updated.data ?? []).length === 0) return { ok: false, reason: "not_found" };

  revalidateAddressBook();
  return { ok: true };
}
