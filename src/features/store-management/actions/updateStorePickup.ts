"use server";

/**
 * updateStorePickup — P27 (FR-SEL-5). Writes `store_pickup_addresses` only.
 *
 * Does not write `stores.delivery_options` (REG-65). When the chosen
 * governorate differs from the store's public governorate, the store
 * governorate is updated first (UI spec P27; ADR-023). The equality trigger
 * then accepts the pickup row. A direct insert with a different governorate
 * is still refused by `trg_pickup_governorate_eq`.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  updateStorePickupSchema,
  type UpdateStorePickupInput,
  type UpdateStorePickupResult,
} from "@/validations/storeDelivery";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

const PICKUP_MISMATCH = "BETK_PICKUP_GOVERNORATE_MISMATCH";

export async function updateStorePickup(
  input: UpdateStorePickupInput,
): Promise<UpdateStorePickupResult> {
  setFeatureContext("store-management");

  const parsed = updateStorePickupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "store-management", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });
  const supabase = await createClient();

  const { data: store, error: readError } = await supabase
    .schema("betk")
    .from("stores")
    .select("id, governorate")
    .eq("seller_id", userId)
    .maybeSingle();

  if (readError) {
    captureTaggedError(readError, "store-management", { extra: { step: "readStore" } });
    return { ok: false, reason: "error" };
  }
  if (!store) return { ok: false, reason: "no_store" };

  if (store.governorate !== parsed.data.governorate) {
    const { data: updated, error: govError } = await supabase
      .schema("betk")
      .from("stores")
      .update({ governorate: parsed.data.governorate })
      .eq("seller_id", userId)
      .select("id");
    if (govError || (updated?.length ?? 0) === 0) {
      captureTaggedError(govError ?? new Error("store governorate update missed"), "store-management", {
        extra: { step: "storeGovernorate" },
      });
      return { ok: false, reason: "error" };
    }
  }

  const { error } = await supabase.schema("betk").from("store_pickup_addresses").upsert(
    {
      store_id: store.id,
      governorate: parsed.data.governorate,
      city: parsed.data.city,
      street_address: parsed.data.streetAddress,
      building_notes: parsed.data.buildingNotes ?? null,
    },
    { onConflict: "store_id" },
  );

  if (error) {
    if ((error.message ?? "").includes(PICKUP_MISMATCH)) return { ok: false, reason: "mismatch" };
    captureTaggedError(error, "store-management", { extra: { step: "pickup" } });
    return { ok: false, reason: "error" };
  }

  captureServerEvent(userId, "store_pickup_updated");
  return { ok: true };
}
