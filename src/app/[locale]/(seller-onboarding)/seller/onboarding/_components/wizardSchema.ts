/**
 * Per-step client Zod — Phase 04 / T04.
 *
 * A CLIENT MIRROR of the T03 server schema slices: every rule here is derived
 * from `submitSellerApplicationSchema` (@/validations/sellerOnboarding) via
 * `.pick(...)`, so the wizard's per-step "can I advance?" checks never drift
 * from the single source of truth the Server Action re-validates. The server
 * schema stays authoritative — this only gives the wizard fast, local,
 * step-scoped feedback (and the 23505 slug catch from the action is STILL the
 * real uniqueness guard, R-S02).
 *
 * Steps 3 (payment) + 4 (delivery) carry NO required fields — R-S09 (≥1 payment
 * method) is the Phase-05 publish gate, not an onboarding gate — so those steps
 * always advance; only their max-length / type rules apply at final submit.
 */

import { submitSellerApplicationSchema } from "@/validations/sellerOnboarding";

/** Step 1 — Identity: store name (ar required / en optional), bio, slug. */
export const identityStepSchema = submitSellerApplicationSchema.pick({
  nameAr: true,
  nameEn: true,
  bioAr: true,
  slug: true,
});

/** Step 2 — Category: primary (required) + secondary (optional), gov/city. */
export const categoryStepSchema = submitSellerApplicationSchema.pick({
  categoryPrimary: true,
  categorySecondary: true,
  governorate: true,
  city: true,
});

/** Step 3 — Payment config (all optional; R-S09 is the Phase-05 publish gate). */
export const paymentStepSchema = submitSellerApplicationSchema.pick({
  paymentMethods: true,
});

/** Step 4 — Delivery config (all optional; consumes the 3-mode REG-14 shape). */
export const deliveryStepSchema = submitSellerApplicationSchema.pick({
  deliveryOptions: true,
});

/** Step 5 — National-ID documents: both storage paths required (R-S05). */
export const documentsStepSchema = submitSellerApplicationSchema.pick({
  docFrontPath: true,
  docBackPath: true,
});
