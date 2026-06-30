"use server";

/**
 * updateProfile — Server Action for /account (T05).
 *
 * Updates the editable buyer_profiles fields (full_name, governorate, city)
 * for the currently authenticated user.
 *
 * RLS boundary:
 *   Uses the authenticated cookie client so the upsert runs under the
 *   `bp_self` policy (PERMISSIVE FOR ALL USING id = auth.uid() OR
 *   betk.is_admin()). PostgreSQL applies the USING expression as WITH CHECK
 *   for UPDATE/INSERT when no explicit WITH CHECK is given — the caller's
 *   id MUST equal auth.uid(), which we enforce by reading the id from the
 *   live GoTrue session, never from the form.
 *
 * CRITICAL — betk.users write check (per task spec):
 *   All editable fields (full_name, governorate, city) live on
 *   betk.buyer_profiles. betk.users has ONLY a users_self FOR SELECT policy
 *   — no permissive UPDATE policy exists. We NEVER write to betk.users here.
 *   phone_number is READ-ONLY (R-A06) and is excluded from the schema.
 *
 * Phase 02 / T05.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/validations/account";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

export interface UpdateProfileResult {
  success?: boolean;
  /** Arabic error message for display. */
  errorAr?: string;
}

export async function updateProfile(
  _prevState: UpdateProfileResult | null,
  formData: FormData,
): Promise<UpdateProfileResult> {
  setFeatureContext("buyer-account");

  // ── Zod validation ─────────────────────────────────────────────────────────
  const parsed = updateProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    governorate: formData.get("governorate"),
    city: formData.get("city") ?? undefined,
  });

  if (!parsed.success) {
    const msg =
      parsed.error.errors[0]?.message ?? "بيانات غير صحيحة. يُرجى التحقق من المدخلات.";
    return { errorAr: msg };
  }

  const { full_name, governorate, city } = parsed.data;

  // ── Verify authenticated session ───────────────────────────────────────────
  // Read id from the live GoTrue session — never trust a form-supplied id.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { errorAr: "يجب تسجيل الدخول أولاً." };
  }

  // ── Upsert buyer_profiles (bp_self RLS — authenticated cookie client) ──────
  // id is always auth.uid() — the user cannot forge a different id.
  const cityValue = city && city.trim() !== "" ? city.trim() : null;

  const { error: upsertError } = await supabase
    .schema("betk")
    .from("buyer_profiles")
    .upsert(
      {
        id: user.id,
        full_name: full_name.trim(),
        governorate,
        ...(cityValue !== null ? { city: cityValue } : { city: null }),
      },
      { onConflict: "id" },
    );

  if (upsertError) {
    captureTaggedError(upsertError, "buyer-account", {
      extra: { step: "updateProfile.upsert" },
    });
    return {
      errorAr: "حدث خطأ أثناء حفظ الملف الشخصي. يُرجى المحاولة مرة أخرى.",
    };
  }

  // ── Sentry + PostHog ───────────────────────────────────────────────────────
  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "buyer_profile_updated");

  return { success: true };
}
