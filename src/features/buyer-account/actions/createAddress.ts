"use server";

/**
 * createAddress — the caller inserts a NEW row into their own `betk.addresses`
 * book. Minimal write needed by CHECKOUT's select-or-create flow (T03) — NOT
 * the full `/account/addresses` Address Book CRUD (edit/delete/set-default
 * stay owned by that still-unbuilt page).
 *
 * RLS boundary: `addr_self` (FOR ALL, USING buyer_id = auth.uid() OR
 * is_admin()) also gates the INSERT's implicit WITH CHECK (no explicit WITH
 * CHECK on this FOR ALL policy → Postgres reuses USING) — `buyer_id` is set
 * from the LIVE session, never from client input.
 *
 * `is_default` is NEVER set true here (DB default false) — see
 * `src/validations/address.ts` header for why this trivially respects the
 * "max one default" invariant without needing app-layer enforcement in this
 * narrow slice.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { createAddressSchema, type CreateAddressInput, type CreateAddressResult } from "@/validations/address";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";

export async function createAddress(input: CreateAddressInput): Promise<CreateAddressResult> {
  setFeatureContext("buyer-account");

  const parsed = createAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const p = parsed.data;

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

  Sentry.setUser({ id: userId });
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("betk")
    .from("addresses")
    .insert({
      buyer_id: userId,
      label: p.label ?? null,
      governorate: p.governorate,
      city: p.city,
      street_address: p.streetAddress,
      building_notes: p.buildingNotes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    captureTaggedError(error ?? new Error("createAddress: no id"), "buyer-account", {
      extra: { step: "insert" },
    });
    return { ok: false, reason: "error" };
  }

  return { ok: true, addressId: data.id };
}
