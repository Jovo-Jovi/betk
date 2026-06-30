/**
 * requireVerifiedPhone — the canonical transaction-time verified-phone gate.
 *
 * This is the APP-LAYER half of the OD-4 phone gate. The RLS WITH CHECK half
 * (`phone_number IS NOT NULL` on orders/seller_profiles/payouts INSERT) is
 * already live from Phase 01; this helper is the single Server-Action gate that
 * the transaction entry points consume:
 *
 *   • checkout         → Phase 07
 *   • become-seller    → Phase 04
 *   • payout request   → Phase 13
 *
 * It exists so those phases call ONE gate rather than re-implementing the
 * phone-NULL + R-A05 checks each time. The gate rejects when EITHER:
 *   1. R-A05 fails — `status != 'active'` OR `deleted_at IS NOT NULL`, OR
 *   2. `phone_number IS NULL` (no verified phone on the account).
 *
 * It loads the user FRESH from the database on every call (never a cached row)
 * so a just-deactivated or just-phone-captured state is always reflected.
 *
 * CONTRACT: throws a typed `AuthUserError` subclass on rejection so the caller
 * decides how to route (render a capture affordance, redirect to /blocked,
 * redirect to /auth/login, …). On success it returns the verified user with a
 * non-null `phone_number`.
 *
 * Per ADR-010 (Model A, GoTrue-canonical). SERVER ONLY.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUserRowById } from "@/services/authUsers";
import {
  AuthUserError,
  UserDeactivatedError,
  UserNotActiveError,
} from "./findOrCreateUser";
import type { Database } from "@/lib/supabase/types";

type UserRow = Database["betk"]["Tables"]["users"]["Row"];

/** No authenticated GoTrue session was present. Route the caller to /auth/login. */
export class NotAuthenticatedError extends AuthUserError {
  constructor() {
    super("No authenticated session.");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * R-A05 + phone gate: the account is active but has no verified phone number.
 * The caller routes the user into the phone-capture flow (/auth/phone).
 */
export class PhoneRequiredError extends AuthUserError {
  constructor(public readonly userId: string) {
    super("A verified phone number is required to transact (phone_number IS NULL).");
    this.name = "PhoneRequiredError";
  }
}

/**
 * The verified, transaction-eligible user. `phone_number` is guaranteed non-null
 * (the gate threw otherwise), narrowed for downstream consumers.
 */
export interface VerifiedPhoneUser extends UserRow {
  phone_number: string;
}

/**
 * Core gate keyed to an explicit, caller-verified user id.
 *
 * Loads `betk.users` FRESH (service-role read — `betk.users` has no permissive
 * UPDATE policy and we want the authoritative current row), then applies, in
 * order:
 *   1. R-A05 deactivated  → UserDeactivatedError
 *   2. R-A05 not-active    → UserNotActiveError
 *   3. phone_number IS NULL → PhoneRequiredError
 *
 * R-A05 is checked BEFORE the phone check so a deactivated/suspended user is
 * always blocked as such — even if they happen to have a phone on file (a
 * deactivated user must never be funnelled into "add a phone" instead of
 * /blocked).
 *
 * `userId` MUST be a session-verified GoTrue uid. Public callers should use
 * `requireVerifiedPhone()` (which derives the id from the live session); this
 * variant is exposed for the session-less path + integration tests.
 *
 * @throws {UserDeactivatedError | UserNotActiveError | PhoneRequiredError | NotAuthenticatedError}
 */
export async function requireVerifiedPhoneForUser(
  userId: string,
): Promise<VerifiedPhoneUser> {
  const row = await getUserRowById(userId);

  if (!row) {
    // The session referenced a betk.users row that doesn't exist — treat as
    // unauthenticated rather than leaking the inconsistency.
    throw new NotAuthenticatedError();
  }

  // ── R-A05 (checked first — see doc) ───────────────────────────────────────
  if (row.deleted_at !== null) {
    throw new UserDeactivatedError(row.id);
  }
  if (row.status !== "active") {
    throw new UserNotActiveError(row.id, row.status);
  }

  // ── Phone gate ────────────────────────────────────────────────────────────
  if (row.phone_number === null) {
    throw new PhoneRequiredError(row.id);
  }

  return row as VerifiedPhoneUser;
}

/**
 * Canonical transaction-time gate — call this from checkout / become-seller /
 * payout entry points.
 *
 * Reads the current user from the live GoTrue session (revalidated via
 * `getUser()`), then delegates to {@link requireVerifiedPhoneForUser}.
 *
 * @throws {NotAuthenticatedError} when there is no session.
 * @throws {UserDeactivatedError | UserNotActiveError} when R-A05 blocks the user.
 * @throws {PhoneRequiredError} when the account has no verified phone number.
 */
export async function requireVerifiedPhone(): Promise<VerifiedPhoneUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new NotAuthenticatedError();
  }

  return requireVerifiedPhoneForUser(user.id);
}
