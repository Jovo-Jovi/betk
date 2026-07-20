/**
 * Payment-methods schema (Zod) — Phase 04 / T07 (FR-SEL-7 / R-S09 config).
 *
 * Validates the /seller/store/payments form BEFORE the `updateStorePayments`
 * Server Action touches the DB (CI `check-zod-coverage`). The schema is the
 * SAME `storePaymentMethodsSchema` the T03/T04 submit path already validates
 * against (`@/validations/sellerOnboarding`) — reused verbatim, not
 * redefined, so the typed `StorePaymentMethods` shape (@/types/jsonb) is
 * consumed identically everywhere. `.strict()` means an unknown key fails
 * validation — the round-trip test asserts exactly this shape.
 *
 * R-S09 (≥1 method required to PUBLISH a listing) is NOT enforced here — this
 * schema only shapes the config write; the Phase-05 publish gate owns the
 * enforcement. This page/action is config + warning-banner only.
 */

import { z } from "zod";
import { storePaymentMethodsSchema } from "@/validations/sellerOnboarding";

export const updateStorePaymentsSchema = storePaymentMethodsSchema;

export type UpdateStorePaymentsInput = z.input<typeof updateStorePaymentsSchema>;
export type UpdateStorePaymentsParsed = z.infer<typeof updateStorePaymentsSchema>;

/**
 * Discriminated result of `updateStorePayments`. Never throws to the client:
 *   - unauthenticated → /auth/login
 *   - blocked         → /blocked (R-A05 deactivated/not-active)
 *   - no_store        → defensive (a seller should always have a store)
 *   - invalid         → inline validation error (Zod)
 *   - error           → generic inline error
 */
export type UpdateStorePaymentsResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "no_store" | "invalid" | "error";
    };
