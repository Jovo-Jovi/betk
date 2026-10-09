"use server";

/**
 * createAddress — insert one row into the caller's `betk.addresses` book.
 *
 * `buyer_id` comes from the live session. The insert does not set
 * `is_default` (the column default is false) and does not write `fullName`
 * or `phone` (no such columns). The buyer's first address becomes the
 * default through `assignSingleDefault`, the same single statement set-default
 * uses. A later address stays non-default unless `makeDefault` is set.
 */

import * as Sentry from "@sentry/nextjs";
import { assignSingleDefault } from "@/features/buyer-account/assignSingleDefault";
import { blankToNull } from "@/features/buyer-account/addressValues";
import { openAddressSession, revalidateAddressBook } from "@/features/buyer-account/addressSession";
import {
  createAddressSchema,
  type CreateAddressInput,
  type CreateAddressResult,
} from "@/validations/address";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

export async function createAddress(input: CreateAddressInput): Promise<CreateAddressResult> {
  setFeatureContext("buyer-account");

  const parsed = createAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const p = parsed.data;

  const session = await openAddressSession();
  if (!session.ok) return session;

  const { supabase, userId } = session;
  Sentry.setUser({ id: userId });

  const inserted = await supabase
    .schema("betk")
    .from("addresses")
    .insert({
      buyer_id: userId,
      label: blankToNull(p.label),
      governorate: p.governorate,
      city: p.city,
      street_address: p.streetAddress,
      building_notes: blankToNull(p.buildingNotes),
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    captureTaggedError(inserted.error ?? new Error("createAddress: no id"), "buyer-account", {
      extra: { step: "insert" },
    });
    return { ok: false, reason: "error" };
  }

  const counted = await supabase
    .schema("betk")
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", userId);

  if (counted.error) {
    captureTaggedError(counted.error, "buyer-account", { extra: { step: "count" } });
    return { ok: false, reason: "error" };
  }

  const firstAddress = counted.count === 1;
  if (firstAddress || p.makeDefault) {
    const assigned = await assignSingleDefault(supabase, userId, inserted.data.id);
    if (!assigned.ok) return { ok: false, reason: "error" };
  }

  revalidateAddressBook();
  return { ok: true, addressId: inserted.data.id };
}
