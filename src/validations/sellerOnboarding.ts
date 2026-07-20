/**
 * Seller-onboarding submit schemas (Zod) — Phase 04 / T03 (FR-SEL-1).
 *
 * The full-payload schema validates every field of the become-seller
 * application BEFORE the `submitSellerApplication` Server Action touches the DB
 * (CI `check-zod-coverage`). Shapes mirror the DB columns (BETK_DATABASE_SCHEMA
 * `betk.stores` / `betk.seller_documents`) and the typed JSONB interfaces in
 * `@/types/jsonb` (`StorePaymentMethods` / `StoreDeliveryOptions`). Delivery
 * modes are the 3 live-schema values `{delivery, pickup, remote}` (REG-14), NOT
 * four.
 *
 * The result type lives here (not in the `"use server"` action file, which may
 * only export async functions) so the action and its T04 client consumer share
 * it. Each `reason` maps to a client route: `unauthenticated` → /auth/login,
 * `phone_required` → /auth/phone, `blocked` → /blocked, `application_exists`
 * (R-S01) → /seller/status, `slug_taken` → field-level error, `invalid` /
 * `error` → inline form error.
 */

import { z } from "zod";

/** URL-safe store slug (R-S02): lowercase alphanumerics + hyphens, ≤50 chars —
 * mirrors `betk.stores.slug VARCHAR(50)` + `chk_store_slug_fmt` CHECK. */
export const storeSlugInputSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/, "slug_format");

/**
 * A storage path the client uploaded to under its OWN prefix (T01 docs-bucket
 * RLS). Shape-only here (`<folder>/<file>`, no traversal, no leading slash); the
 * ACTION additionally verifies the first path segment equals the caller's
 * `auth.uid()` — a path outside the caller's prefix is never accepted.
 */
export const storageObjectPathSchema = z
  .string()
  .trim()
  .min(3)
  .max(400)
  .regex(/^[^/][^\s]*\/[^\s]+$/, "storage_path")
  .refine((p) => !p.includes(".."), "storage_path_traversal");

/** stores.payment_methods JSONB — mirrors `StorePaymentMethods` (@/types/jsonb). */
export const storePaymentMethodsSchema = z
  .object({
    instapay_handle: z.string().trim().max(100).optional(),
    vodafone_cash: z.string().trim().max(20).optional(),
    orange_cash: z.string().trim().max(20).optional(),
    cod_enabled: z.boolean().optional(),
  })
  .strict();

/** stores.delivery_options JSONB — mirrors `StoreDeliveryOptions` (@/types/jsonb).
 * modes = the 3 live `betk.delivery_preference` values (REG-14), not four. */
export const storeDeliveryOptionsSchema = z
  .object({
    modes: z.array(z.enum(["delivery", "pickup", "remote"])).max(3).optional(),
    min_delivery_days: z.number().int().min(0).max(365).optional(),
    max_delivery_days: z.number().int().min(0).max(365).optional(),
    delivery_fee_egp: z.number().nonnegative().max(100000).optional(),
    free_delivery_threshold_egp: z.number().nonnegative().max(1000000).optional(),
    pickup_governorate: z.string().trim().max(50).optional(),
    ships_nationwide: z.boolean().optional(),
  })
  .strict();

/**
 * Full become-seller application payload. `name_ar` required / `name_en`
 * optional (COALESCE display set); `bio_ar` optional; `category_primary`
 * required + `category_secondary` optional (free-text picker values stored as
 * text per schema); `governorate` required + `city` optional; both national-ID
 * document storage paths required (R-S05 front + back).
 */
export const submitSellerApplicationSchema = z.object({
  nameAr: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().min(2).max(100).optional(),
  bioAr: z.string().trim().max(200).optional(),
  slug: storeSlugInputSchema,
  categoryPrimary: z.string().trim().min(1).max(50),
  categorySecondary: z.string().trim().min(1).max(50).optional(),
  governorate: z.string().trim().min(1).max(50),
  city: z.string().trim().min(1).max(100).optional(),
  paymentMethods: storePaymentMethodsSchema.default({}),
  deliveryOptions: storeDeliveryOptionsSchema.default({}),
  returnPolicy: z.string().trim().max(2000).optional(),
  minOrderEgp: z.number().nonnegative().max(1000000).optional(),
  docFrontPath: storageObjectPathSchema,
  docBackPath: storageObjectPathSchema,
});

export type SubmitSellerApplicationInput = z.input<typeof submitSellerApplicationSchema>;
export type SubmitSellerApplicationParsed = z.infer<typeof submitSellerApplicationSchema>;

/**
 * Discriminated result of `submitSellerApplication`. Never throws to the client;
 * the T04 wizard routes on `reason`:
 *   - unauthenticated     → /auth/login?returnUrl=…
 *   - phone_required      → /auth/phone (OD-4 capture)
 *   - blocked             → /blocked (R-A05 deactivated/suspended)
 *   - application_exists  → /seller/status (R-S01, one store per seller)
 *   - slug_taken          → field-level "slug taken" error (R-S02)
 *   - invalid             → inline validation error (Zod / path ownership)
 *   - error               → generic inline error
 */
export type SubmitSellerApplicationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "phone_required"
        | "blocked"
        | "application_exists"
        | "slug_taken"
        | "invalid"
        | "error";
    };

/**
 * Resubmit payload (Phase 04 / T05, MW2) — re-upload only. The confirmed state
 * model (see `resubmit_seller_application` rpc, BETK_DATABASE_SCHEMA.sql)
 * UPDATEs the caller's own two existing `seller_documents` rows in place
 * (uq_seller_doc_type forbids a second INSERT per doc_type); no store/profile
 * fields are re-submitted here — the "edit store" link is a separate route
 * (/seller/store, T06). Both paths must be under the caller's OWN prefix
 * (re-verified server-side, same discipline as `submitSellerApplicationSchema`).
 */
export const resubmitSellerApplicationSchema = z.object({
  docFrontPath: storageObjectPathSchema,
  docBackPath: storageObjectPathSchema,
});

export type ResubmitSellerApplicationInput = z.input<typeof resubmitSellerApplicationSchema>;
export type ResubmitSellerApplicationParsed = z.infer<typeof resubmitSellerApplicationSchema>;

/**
 * Discriminated result of `resubmitSellerApplication`. Never throws to the
 * client; the T05 status page routes on `reason`:
 *   - unauthenticated  → /auth/login
 *   - blocked          → /blocked (R-A05 deactivated/suspended)
 *   - not_rejected     → the server-side rejected-only guard bit (status
 *                         changed underneath the caller, e.g. already
 *                         resubmitted in another tab) — refresh the page
 *   - invalid          → inline validation error (Zod / path ownership)
 *   - error            → generic inline error
 */
export type ResubmitSellerApplicationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "blocked" | "not_rejected" | "invalid" | "error";
    };
