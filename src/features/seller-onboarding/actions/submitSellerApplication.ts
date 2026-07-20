"use server";

/**
 * submitSellerApplication — Phase 04 / T03 (FR-SEL-1, OD-4). The become-seller
 * submit: writes seller_profiles + stores + 2 seller_documents atomically, then
 * flips betk.users.role → 'seller' LAST. Never throws to the client — returns a
 * discriminated `SubmitSellerApplicationResult` the T04 wizard routes on.
 *
 * ORDER (ADR-012 + the canonical gate):
 *   1. requireVerifiedPhone() FIRST — R-A05 (active + not-deactivated) THEN the
 *      phone gate. Typed errors route the caller: NotAuthenticated → /auth/login,
 *      Deactivated/NotActive → /blocked, PhoneRequired → /auth/phone.
 *   2. Server-side prefix-ownership check on the two doc storage PATHS the client
 *      uploaded (T01 docs-bucket RLS already enforced own-prefix at upload time;
 *      this is defense-in-depth) — never accept a path outside auth.uid()'s prefix.
 *   3. betk.submit_seller_application(...) rpc — ONE transaction (ADR-012):
 *      seller_profiles + stores + 2 seller_documents commit together or roll back
 *      together (no partial residue). SECURITY INVOKER, so the RESTRICTIVE
 *      seller_profiles_phone_gate + the ownership WITH CHECKs enforce at the DB
 *      layer too. 23505 → BETK_SLUG_TAKEN (field-level) / BETK_APPLICATION_EXISTS
 *      (R-S01). Pre-checks are UX-only; the rpc's 23505 catch is authoritative.
 *   4. setUserRole(uid, 'seller') LAST (REG-19 service-role helper) — the profile
 *      row provably exists first (the rpc committed), so the middleware seller-gate
 *      never strands a role='seller' user with no profile.
 *
 * PII DISCIPLINE (national IDs): the docs bucket is PRIVATE. No document path,
 * filename, or content is ever put in a log, Sentry event, PostHog property, or
 * error message. Sentry stays id-only; the PostHog event carries no doc data.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireVerifiedPhone,
  NotAuthenticatedError,
  PhoneRequiredError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { setUserRole } from "@/services/authUsers";
import {
  submitSellerApplicationSchema,
  type SubmitSellerApplicationInput,
  type SubmitSellerApplicationResult,
} from "@/validations/sellerOnboarding";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** The rpc raises these opaque tokens (never containing PII) on 23505. */
const RPC_SLUG_TAKEN = "BETK_SLUG_TAKEN";
const RPC_APPLICATION_EXISTS = "BETK_APPLICATION_EXISTS";

/** First path segment (the storage prefix) — must equal the caller's uid. */
function ownsPrefix(path: string, uid: string): boolean {
  return path.split("/")[0] === uid;
}

export async function submitSellerApplication(
  input: SubmitSellerApplicationInput,
): Promise<SubmitSellerApplicationResult> {
  setFeatureContext("seller-onboarding");

  // ── Zod validation (before any DB call / gate) ──────────────────────────────
  const parsed = submitSellerApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const app = parsed.data;

  // ── 1) Canonical verified-phone gate FIRST (R-A05 order, then phone) ────────
  let userId: string;
  try {
    const user = await requireVerifiedPhone();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, reason: "unauthenticated" };
    }
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    if (err instanceof PhoneRequiredError) {
      return { ok: false, reason: "phone_required" };
    }
    captureTaggedError(err, "seller-onboarding", { extra: { step: "requireVerifiedPhone" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  // ── 2) Prefix-ownership on the uploaded doc paths (no path leaves auth.uid()'s
  //       prefix). NOTE: paths are PII-adjacent — never logged. ────────────────
  if (!ownsPrefix(app.docFrontPath, userId) || !ownsPrefix(app.docBackPath, userId)) {
    // Do NOT include the paths in the event (docs bucket is private).
    captureTaggedError(
      new Error("seller-onboarding: doc path outside caller prefix"),
      "seller-onboarding",
      { extra: { step: "prefixOwnership" } },
    );
    return { ok: false, reason: "invalid" };
  }

  // ── 3) Atomic multi-table write via the SECURITY INVOKER rpc (ADR-012) ──────
  const supabase = await createClient();
  const { error: rpcError } = await supabase.schema("betk").rpc("submit_seller_application", {
    p_name_ar: app.nameAr,
    p_name_en: app.nameEn ?? null,
    p_bio_ar: app.bioAr ?? null,
    p_slug: app.slug,
    p_category_primary: app.categoryPrimary,
    p_category_secondary: app.categorySecondary ?? null,
    p_governorate: app.governorate,
    p_city: app.city ?? null,
    p_payment_methods: app.paymentMethods,
    p_delivery_options: app.deliveryOptions,
    p_return_policy: app.returnPolicy ?? null,
    p_min_order_egp: app.minOrderEgp ?? null,
    p_doc_front_path: app.docFrontPath,
    p_doc_back_path: app.docBackPath,
  });

  if (rpcError) {
    const message = rpcError.message ?? "";

    // Slug collision (R-S02) → field-level "slug taken". Atomic rollback left
    // ZERO rows (the no-partial-residue invariant, ADR-012).
    if (message.includes(RPC_SLUG_TAKEN)) {
      return { ok: false, reason: "slug_taken" };
    }

    // Existing application (R-S01, one store per seller) → /seller/status. Heal a
    // prior submit whose rpc committed but whose role flip failed (ADR-012
    // residual): re-run the idempotent flip so the seller-gate resolves.
    if (message.includes(RPC_APPLICATION_EXISTS)) {
      try {
        await setUserRole(userId, "seller");
      } catch (healErr) {
        captureTaggedError(healErr, "seller-onboarding", { extra: { step: "roleFlipHeal" } });
      }
      return { ok: false, reason: "application_exists" };
    }

    captureTaggedError(rpcError, "seller-onboarding", { extra: { step: "submitRpc" } });
    return { ok: false, reason: "error" };
  }

  // ── 4) Role flip LAST (REG-19 service-role helper); profile now exists ──────
  try {
    await setUserRole(userId, "seller");
  } catch (roleErr) {
    // The rpc committed (application exists) but the flip failed — the SAFE
    // strand direction (role stays 'buyer', never 'seller' with no profile). A
    // re-submit hits BETK_APPLICATION_EXISTS above and heals the flip.
    captureTaggedError(roleErr, "seller-onboarding", { extra: { step: "roleFlip" } });
    return { ok: false, reason: "error" };
  }

  // ── Analytics (id-only; NO document paths/filenames — PII discipline) ───────
  captureServerEvent(userId, "seller_application_submitted");

  return { ok: true };
}
