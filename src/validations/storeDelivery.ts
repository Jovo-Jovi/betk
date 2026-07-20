/**
 * Delivery-settings schema (Zod) — Phase 04 / T07 (FR-SEL-5).
 *
 * Validates the /seller/store/delivery form BEFORE the `updateStoreDelivery`
 * Server Action touches the DB (CI `check-zod-coverage`). The schema is the
 * SAME `storeDeliveryOptionsSchema` the T03/T04 submit path already validates
 * against (`@/validations/sellerOnboarding`) — reused verbatim, not
 * redefined, so the typed `StoreDeliveryOptions` shape (@/types/jsonb, REG-14)
 * is consumed identically everywhere and never reshaped. `.strict()` means an
 * unknown key fails validation — the round-trip test asserts exactly this
 * shape, no extra/missing keys.
 *
 * `modes` may legitimately be empty (all 3 delivery methods disabled) — the
 * UI_SPEC Delivery Settings edge case says this warrants a warning, NOT a
 * save-block (no spec line forbids saving); the page still calls this action.
 */

import { z } from "zod";
import { storeDeliveryOptionsSchema } from "@/validations/sellerOnboarding";
import type { StoreDeliveryOptions } from "@/types/jsonb";

/** The 3 live `betk.delivery_preference` modes (REG-14) — not four. */
export type DeliveryMode = NonNullable<StoreDeliveryOptions["modes"]>[number];
export const DELIVERY_MODES: readonly DeliveryMode[] = ["delivery", "pickup", "remote"];

export const updateStoreDeliverySchema = storeDeliveryOptionsSchema;

export type UpdateStoreDeliveryInput = z.input<typeof updateStoreDeliverySchema>;
export type UpdateStoreDeliveryParsed = z.infer<typeof updateStoreDeliverySchema>;

/**
 * Discriminated result of `updateStoreDelivery`. Never throws to the client:
 *   - unauthenticated → /auth/login
 *   - blocked         → /blocked (R-A05 deactivated/not-active)
 *   - no_store        → defensive (a seller should always have a store)
 *   - invalid         → inline validation error (Zod)
 *   - error           → generic inline error
 */
export type UpdateStoreDeliveryResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "no_store" | "invalid" | "error";
    };
