/**
 * Return-policy schema (Zod) — Phase 04 / T07 (FR-SEL-6).
 *
 * Validates the /seller/store/returns form BEFORE the `updateStoreReturns`
 * Server Action touches the DB (CI `check-zod-coverage`). Mirrors
 * `betk.stores.return_policy TEXT NULL` — an empty policy is EXPLICITLY
 * allowed (the ACTION collapses an empty/omitted string to `NULL`, never an
 * empty string, so the DB round-trips true-NULL for "no policy set").
 */

import { z } from "zod";

export const updateStoreReturnsSchema = z.object({
  returnPolicy: z.string().trim().max(2000).optional(),
});

export type UpdateStoreReturnsInput = z.input<typeof updateStoreReturnsSchema>;
export type UpdateStoreReturnsParsed = z.infer<typeof updateStoreReturnsSchema>;

/**
 * Discriminated result of `updateStoreReturns`. Never throws to the client:
 *   - unauthenticated → /auth/login
 *   - blocked         → /blocked (R-A05 deactivated/not-active)
 *   - no_store        → defensive (a seller should always have a store)
 *   - invalid         → inline validation error (Zod)
 *   - error           → generic inline error
 */
export type UpdateStoreReturnsResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "no_store" | "invalid" | "error";
    };
