"use server";

/**
 * deactivateAccount — Server Action for /account (Phase 02 / T06, OD-2).
 *
 * DEACTIVATE-only (no hard delete, no anonymization in MVP). Sets
 * `betk.users.deleted_at = now()` for the CURRENT user, signs the GoTrue
 * session out, then redirects to a public page.
 *
 * SECURITY (review focus, T06):
 *   - The write target id is read from the live GoTrue session
 *     (`supabase.auth.getUser()`), NEVER from the form. The action can only ever
 *     deactivate `auth.uid()` — never another user.
 *   - The write itself (`@/services/authUsers.deactivateAccount`) sets ONLY
 *     `deleted_at`. It never touches `anonymized_at` (reserved) or any other
 *     column. See the helper's doc for the Option-A (service-role) rationale:
 *     `betk.users` has no permissive UPDATE policy and the all-column
 *     `authenticated` grant makes a scoped policy (Option B) a privilege-
 *     escalation risk; the service-role path keeps the write column-scoped.
 *   - signOut() is awaited and MUST complete BEFORE the redirect — the user
 *     still holds a valid session cookie until the GoTrue session is
 *     invalidated. Redirecting first would leave a live cookie for one round
 *     trip. The R-A05 re-check (findOrCreateUser at verify/callback) and
 *     middleware (deleted_at IS NOT NULL → /blocked) close the loop on every
 *     subsequent request regardless.
 *
 * Zod-validated (CI zod-coverage guard): `deactivateAccountSchema` requires an
 * explicit confirmation token so deactivation cannot fire without deliberate
 * confirmation.
 */

import { redirect } from "next/navigation";
import type { Route } from "next";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { deactivateAccountSchema } from "@/validations/account";
import { deactivateAccount as deactivateUserRow } from "@/services/authUsers";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** Public landing page after deactivation + sign-out. */
const POST_DEACTIVATION_PATH = "/";

export interface DeactivateAccountResult {
  /** Arabic error message for display. Success never returns — it redirects. */
  errorAr?: string;
}

export async function deactivateAccount(
  _prevState: DeactivateAccountResult | null,
  formData: FormData,
): Promise<DeactivateAccountResult> {
  setFeatureContext("buyer-account");

  // ── Zod validation: explicit confirmation required ──────────────────────────
  const parsed = deactivateAccountSchema.safeParse({
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const msg =
      parsed.error.errors[0]?.message ?? "يجب تأكيد تعطيل الحساب قبل المتابعة.";
    return { errorAr: msg };
  }

  // ── Verify authenticated session — id comes from GoTrue, never the form ─────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { errorAr: "يجب تسجيل الدخول أولاً." };
  }

  // ── Set deleted_at for auth.uid() only (service-role, deleted_at-only) ──────
  try {
    await deactivateUserRow(user.id);
  } catch (err) {
    captureTaggedError(err as Error, "buyer-account", {
      extra: { step: "deactivateAccount.update" },
    });
    return {
      errorAr: "تعذّر تعطيل الحساب. يُرجى المحاولة مرة أخرى.",
    };
  }

  Sentry.setUser({ id: user.id });
  captureServerEvent(user.id, "account_deactivated");

  // ── Invalidate the session BEFORE redirecting ───────────────────────────────
  // The user still holds a valid session cookie until signOut completes; await
  // it so the cookie is cleared before we hand back a redirect. Even if signOut
  // fails, deleted_at is already set → middleware (R-A05) blocks the next
  // request and findOrCreateUser rejects any re-auth.
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    captureTaggedError(signOutError, "buyer-account", {
      extra: { step: "deactivateAccount.signOut" },
    });
  }

  // redirect() throws NEXT_REDIRECT — keep it outside the try/catch above.
  // Unprefixed "/" resolves to the Arabic (default) home; after sign-out the
  // locale cookie no longer matters. `as Route` per the repo route-literal
  // convention (standalone tsc doesn't regenerate Next's typed-routes union).
  redirect(POST_DEACTIVATION_PATH as Route);
}
