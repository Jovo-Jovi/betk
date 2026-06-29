/**
 * Google OAuth callback — Phase 02 / T03 (Opus-reviewed: unauthenticated entry point).
 *
 * The browser `GoogleSignInButton` (T02) calls `signInWithOAuth({ provider:'google',
 * redirectTo: ${origin}/auth/callback })`. Google redirects the user back here with a
 * one-time PKCE authorization `code`. This route exchanges that code for a session,
 * mirrors the identity into `betk.users` (find-or-create), and role-routes.
 *
 * Path note: the `(auth)` segment is a URL-invisible route group; `auth/callback` is the
 * REAL URL path. So this handler resolves to `/auth/callback` — matching the `redirectTo`.
 *
 * SECURITY (why this is Opus-reviewed):
 *  - State / PKCE handling is left ENTIRELY to Supabase Auth (`exchangeCodeForSession`).
 *    We never hand-roll state validation or the verifier — GoTrue reads the PKCE verifier
 *    from the HttpOnly cookie set at initiation and rejects a forged / replayed code.
 *  - The code exchange happens SERVER-SIDE only (this route handler). No access/refresh
 *    token is ever serialised into the HTML or query string — tokens live only in the
 *    HttpOnly Supabase cookies set on the response.
 *  - find-or-create matches STRICTLY on `auth.users.id` (see findOrCreateUser /
 *    getUserRowById). It NEVER matches on email, so an OAuth sign-in cannot collapse into
 *    an existing phone-based account and hijack it. A new Google identity is a new
 *    `auth.users.id` ⇒ a new `betk.users` row (auth_provider='google', phone_number=NULL).
 *  - R-A05 is re-checked inside findOrCreateUser: a deactivated (`deleted_at`) or
 *    non-active user is blocked and signed out here, never resurrected.
 *  - Provider error text (`error_description`) is NEVER echoed to the client.
 *
 * Per ADR-010 (Model A, GoTrue-canonical).
 */

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oauthCallbackSchema } from "@/validations/auth";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { updateLastLoginAt, resolvePostAuthRedirect } from "@/services/authUsers";
import {
  findOrCreateUser,
  UserDeactivatedError,
  UserNotActiveError,
  PhoneNumberTakenError,
} from "@/features/auth";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

/** Login page with a generic, non-enumerating OAuth failure flag. */
const OAUTH_ERROR_PATH = "/auth/login?error=oauth";
/** R-A05 terminal page for deactivated / suspended accounts. */
const BLOCKED_PATH = "/blocked";

export async function GET(request: NextRequest): Promise<NextResponse> {
  setFeatureContext("auth-oauth");

  const url = new URL(request.url);

  // ── Zod validation of the redirect inputs ─────────────────────────────────
  const parsed = oauthCallbackSchema.safeParse({
    code: url.searchParams.get("code"),
    error: url.searchParams.get("error"),
    error_description: url.searchParams.get("error_description"),
    returnUrl: url.searchParams.get("returnUrl") ?? url.searchParams.get("next"),
  });

  // Provider returned an error (consent denied), the params were malformed, or no
  // code was supplied. Fail closed — never echo provider error text to the client.
  if (!parsed.success || parsed.data.error || !parsed.data.code) {
    return redirectTo(url, OAUTH_ERROR_PATH);
  }

  const { code } = parsed.data;
  const returnUrl = sanitizeReturnUrl(parsed.data.returnUrl);

  const supabase = await createClient();

  // ── Exchange the authorization code for a session (server-side only) ──────
  // Supabase Auth verifies state/PKCE and sets HttpOnly session cookies on the
  // response. No token is ever returned to the page or placed in a URL.
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !exchangeData.user) {
    captureTaggedError(
      exchangeError ?? new Error("[auth-callback] code exchange returned no user"),
      "auth-oauth",
    );
    return redirectTo(url, OAUTH_ERROR_PATH);
  }

  const goTrueUser = exchangeData.user;

  // ── find-or-create (T01 primitive) — match strictly on auth.users.id ──────
  // Google identities carry NO phone, so phone_number is NULL on the create
  // branch. A returning user is matched by id and the row is reused as-is
  // (provider/phone args are ignored once the row exists).
  let betKUser;
  try {
    betKUser = await findOrCreateUser({
      id: goTrueUser.id,
      phoneNumber: null,
      authProvider: "google",
    });
  } catch (err) {
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      // R-A05: block + clear the freshly-minted session. Do NOT resurrect.
      await supabase.auth.signOut();
      return redirectTo(url, BLOCKED_PATH);
    }
    if (err instanceof PhoneNumberTakenError) {
      // Cannot occur for Google (phone NULL), but fail closed defensively.
      await supabase.auth.signOut();
      captureTaggedError(err, "auth-oauth");
      return redirectTo(url, OAUTH_ERROR_PATH);
    }
    captureTaggedError(err, "auth-oauth");
    return redirectTo(url, OAUTH_ERROR_PATH);
  }

  // ── last_login_at (service-role — no self-UPDATE policy; non-critical) ─────
  try {
    await updateLastLoginAt(betKUser.id);
  } catch (err) {
    captureTaggedError(err, "auth-oauth", { extra: { step: "updateLastLoginAt" } });
  }

  // ── Observability — id only, no PII ───────────────────────────────────────
  Sentry.setUser({ id: betKUser.id });
  captureServerEvent(betKUser.id, "google_oauth_verified");

  // ── Role-route (buyer w/ no buyer_profile → /auth/register, per T04) ──────
  const destination = await resolvePostAuthRedirect(
    betKUser.id,
    betKUser.role,
    returnUrl,
  );

  return redirectTo(url, destination);
}

/** Build a same-origin redirect response. `path` is already a sanitised local path. */
function redirectTo(base: URL, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, base.origin));
}
