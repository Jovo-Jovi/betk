/**
 * Seller-onboarding submit schemas (Zod) — Phase 04 / T03, Phase 09 / T06.
 *
 * The full-payload schema validates every field BEFORE `submitSellerApplication`
 * touches the DB. P23 collects store identity, category ids (the cap is the
 * database trigger, not this schema), the seller's pickup street, the seller
 * agreement e-sign, national-id paths, and the four food artefacts when a food
 * category is chosen.
 *
 * `storeDeliveryOptionsSchema` stays for listing overrides (P31). The onboarding
 * submit schema does not accept it (REG-65, OD-10). `stores.delivery_options`
 * is written by the RPC as `{}`.
 *
 * The result type lives here (not in the `"use server"` action file, which may
 * only export async functions). `agreement_required` is the RPC token
 * `BETK_SELLER_AGREEMENT_REQUIRED` (AC-AGR-3). A missing acceptance is not a
 * disabled button.
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

/** Listing delivery-override JSONB. Not accepted by the onboarding submit. */
export const DELIVERY_MODES = ["delivery", "pickup", "remote"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

/** stores.delivery_options JSONB — mirrors `StoreDeliveryOptions` (@/types/jsonb).
 * modes = the 3 live `betk.delivery_preference` values (REG-14), not four.
 * P23 and P27 do not send this object. */
export const storeDeliveryOptionsSchema = z
  .object({
    modes: z.array(z.enum(DELIVERY_MODES)).max(3).optional(),
    min_delivery_days: z.number().int().min(0).max(365).optional(),
    max_delivery_days: z.number().int().min(0).max(365).optional(),
    delivery_fee_egp: z.number().nonnegative().max(100000).optional(),
    free_delivery_threshold_egp: z.number().nonnegative().max(1000000).optional(),
    pickup_governorate: z.string().trim().max(50).optional(),
    ships_nationwide: z.boolean().optional(),
  })
  .strict();

/** `categories.id`. The store-category cap is `enforce_store_category_cap`, not this bound. */
export const categoryIdSchema = z.string().uuid();

/** Pickup street collected on P23. Governorate is the store's public governorate. */
export const onboardingPickupSchema = z
  .object({
    city: z.string().trim().min(1).max(100),
    streetAddress: z.string().trim().min(1).max(2000),
    buildingNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

/** Four R-S10 artefacts. The social value is a URL stored on `seller_documents`, not a file. */
export const foodArtefactsSchema = z
  .object({
    packagingPath: storageObjectPathSchema,
    labelPath: storageObjectPathSchema,
    expiryPath: storageObjectPathSchema,
    socialUrl: z.string().trim().url().max(500),
  })
  .strict();

/**
 * Full become-seller application. Category ids are inserted into
 * `store_categories` by the action. The RPC still receives the primary slug as
 * non-authoritative text. No delivery modes and no delivery fee.
 */
export const submitSellerApplicationSchema = z
  .object({
    nameAr: z.string().trim().min(2).max(100),
    nameEn: z.string().trim().min(2).max(100).optional(),
    bioAr: z.string().trim().max(200).optional(),
    slug: storeSlugInputSchema,
    categoryIds: z.array(categoryIdSchema).min(1).max(12),
    governorate: z.string().trim().min(1).max(50),
    city: z.string().trim().min(1).max(100).optional(),
    pickup: onboardingPickupSchema,
    sellerAgreementAccepted: z.boolean(),
    docFrontPath: storageObjectPathSchema,
    docBackPath: storageObjectPathSchema,
    food: foodArtefactsSchema.optional(),
  })
  .strict();

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
 *   - agreement_required  → the RPC refused (AC-AGR-3); the acceptance row is missing
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
        | "agreement_required"
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
