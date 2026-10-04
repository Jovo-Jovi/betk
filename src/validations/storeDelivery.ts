/**
 * Pickup-address schema (Zod) — Phase 09 / T06 (FR-SEL-5, P27).
 *
 * Validates `/seller/store/delivery` BEFORE the action writes. The table is
 * `store_pickup_addresses` (governorate, city, street_address, building_notes).
 * This schema has no delivery mode, no delivery fee, and no `delivery_options`
 * key (REG-65, OD-10). `.strict()` rejects a client that still sends those.
 */

import { z } from "zod";

export const updateStorePickupSchema = z
  .object({
    governorate: z.string().trim().min(1).max(50),
    city: z.string().trim().min(1).max(100),
    streetAddress: z.string().trim().min(1).max(2000),
    buildingNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type UpdateStorePickupInput = z.input<typeof updateStorePickupSchema>;
export type UpdateStorePickupParsed = z.infer<typeof updateStorePickupSchema>;

/**
 * Discriminated result of `updateStorePickup`. Never throws to the client.
 * `mismatch` is `BETK_PICKUP_GOVERNORATE_MISMATCH` when the row's governorate
 * does not equal the store's.
 */
export type UpdateStorePickupResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "no_store" | "invalid" | "mismatch" | "error";
    };
