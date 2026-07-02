"use server";

/**
 * completeProfile — Server Action for /auth/register (T04).
 *
 * Creates or updates the buyer_profiles row for the authenticated user.
 *
 * RLS boundary:
 *   The `bp_self` policy (PERMISSIVE FOR ALL, USING id = auth.uid() OR
 *   betk.is_admin()) governs this insert. PostgreSQL applies the USING
 *   expression as WITH CHECK for INSERT when no explicit WITH CHECK is
 *   given. Because we always set id = auth.uid() (verified from the live
 *   GoTrue session — never from the form), the check passes for the row
 *   owner and fails for anyone else. The authenticated cookie client is
 *   used deliberately to exercise this RLS path — NOT the service-role
 *   client (ADR-010 Model A, BETK_ARCHITECTURE §3).
 *
 * Idempotence: upsert (onConflict: 'id') so a returning user who somehow
 *   reaches this page can update their profile without creating a duplicate.
 *
 * Phase 02 / T04.
 */

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { completeProfileSchema } from "@/validations/auth";
import { translateZodIssue } from "@/validations/zodMessages";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

export interface CompleteProfileResult {
  success?: boolean;
  /** Arabic error message for display. */
  errorAr?: string;
}

export async function completeProfile(
  _prevState: CompleteProfileResult | null,
  formData: FormData,
): Promise<CompleteProfileResult> {
  setFeatureContext("auth");

  const tValidation = await getTranslations("validation");
  const tErrors = await getTranslations("errors");

  // ── Zod validation ─────────────────────────────────────────────────────────
  const parsed = completeProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    governorate: formData.get("governorate"),
    city: formData.get("city") ?? undefined,
    returnUrl: formData.get("returnUrl") ?? undefined,
  });

  if (!parsed.success) {
    return { errorAr: translateZodIssue(tValidation, parsed.error.errors[0]?.message) };
  }

  const { full_name, governorate, city, returnUrl: rawReturnUrl } = parsed.data;
  const returnUrl = sanitizeReturnUrl(rawReturnUrl);

  // ── Verify authenticated session ───────────────────────────────────────────
  // The cookie client carries the GoTrue session set by verifyOtp/callback.
  // We read the user from the live session — never trust a client-supplied id.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { errorAr: tErrors("mustLoginFirst") };
  }

  // ── Upsert buyer_profiles (bp_self RLS — authenticated cookie client) ──────
  // id is always set to auth.uid() — the user cannot forge a different id since
  // the value comes from the live GoTrue session, not the form.
  const cityValue = city && city.trim() !== "" ? city.trim() : null;

  const { error: upsertError } = await supabase
    .schema("betk")
    .from("buyer_profiles")
    .upsert(
      {
        id: user.id,
        full_name: full_name.trim(),
        governorate,
        ...(cityValue !== null ? { city: cityValue } : {}),
      },
      { onConflict: "id" },
    );

  if (upsertError) {
    captureTaggedError(upsertError, "auth", {
      extra: { step: "completeProfile.upsert" },
    });
    return {
      errorAr: tErrors("profileSaveFailed"),
    };
  }

  // ── Sentry + PostHog ───────────────────────────────────────────────────────
  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "buyer_profile_completed");

  // ── Redirect ───────────────────────────────────────────────────────────────
  redirect((returnUrl || "/") as Route);
}
