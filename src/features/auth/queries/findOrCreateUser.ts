/**
 * findOrCreateUser — the shared identity primitive for Phase 02 auth.
 *
 * Given an authenticated GoTrue identity (extracted from `supabase.auth.getUser()`
 * by the caller), find the matching `betk.users` row by id or create it. This is
 * the single primitive that BOTH phone sign-in (T02) and Google OAuth (T03) call,
 * so the mirror logic + R-A05 gate live in exactly one place.
 *
 * Per ADR-010 (Model A): Supabase Auth is canonical; `betk.users` mirrors
 * `auth.users.id` 1:1. The CREATE branch is delegated to `@/services/authUsers`
 * (service-role; required because `betk.users` has no permissive INSERT policy).
 *
 * R-A05 is re-checked here (status='active' AND deleted_at IS NULL) so a
 * suspended/deactivated identity can never be resurrected by a fresh sign-in —
 * notably a deactivated user returning via Google OAuth (T03).
 *
 * NOTE: this primitive intentionally does NOT set `last_login_at` — that belongs
 * to the T02 verify action. It only finds-or-creates and gates on R-A05.
 *
 * SERVER ONLY.
 */

import "server-only";
import { authIdentitySchema, type AuthIdentity } from "@/validations/auth";
import {
  getUserRowById,
  insertUserRow,
} from "@/services/authUsers";
import type { Database } from "@/lib/supabase/types";
import type { UserStatus } from "@/constants/enums";

type UserRow = Database["betk"]["Tables"]["users"]["Row"];

/** Base class so callers can `catch (e) { if (e instanceof AuthUserError) ... }`. */
export class AuthUserError extends Error {}

/** R-A05: user has `deleted_at` set (OD-2 deactivation). Route to /blocked; never resurrect. */
export class UserDeactivatedError extends AuthUserError {
  constructor(public readonly userId: string) {
    super("User account is deactivated (deleted_at is set).");
    this.name = "UserDeactivatedError";
  }
}

/** R-A05: user `status` is not 'active' (suspended / banned / pending). */
export class UserNotActiveError extends AuthUserError {
  constructor(
    public readonly userId: string,
    public readonly status: UserStatus,
  ) {
    super(`User account is not active (status='${status}').`);
    this.name = "UserNotActiveError";
  }
}

/**
 * The phone number on the identity already belongs to a DIFFERENT account.
 * Cannot happen for Google (phone NULL); a phone sign-in normally links to the
 * same identity. Surfaced for T07 (phone capture on a Google-only account).
 */
export class PhoneNumberTakenError extends AuthUserError {
  constructor(public readonly phoneNumber: string | null) {
    super("Phone number already belongs to another account.");
    this.name = "PhoneNumberTakenError";
  }
}

/**
 * Find the `betk.users` row for `identity`, creating it on first sign-in.
 *
 * @throws {UserDeactivatedError | UserNotActiveError} when R-A05 blocks the user.
 * @throws {PhoneNumberTakenError} when the phone maps to a different account.
 * @returns the active `betk.users` row.
 */
export async function findOrCreateUser(
  identity: AuthIdentity,
): Promise<UserRow> {
  // Defense-in-depth: re-validate even though the type is AuthIdentity.
  const parsed = authIdentitySchema.parse(identity);

  let row = await getUserRowById(parsed.id);

  if (!row) {
    const result = await insertUserRow({
      id: parsed.id,
      phoneNumber: parsed.phoneNumber,
      authProvider: parsed.authProvider,
    });

    if ("conflict" in result) {
      if (result.conflict === "id_race") {
        // A concurrent sign-in created the row first — read the winner.
        row = await getUserRowById(parsed.id);
        if (!row) {
          throw new AuthUserError(
            "[findOrCreateUser] id race reported but row is still missing.",
          );
        }
      } else {
        throw new PhoneNumberTakenError(parsed.phoneNumber);
      }
    } else {
      row = result.row;
    }
  }

  assertActive(row);
  return row;
}

/** R-A05 gate: active AND not deactivated. */
function assertActive(row: UserRow): void {
  if (row.deleted_at !== null) {
    throw new UserDeactivatedError(row.id);
  }
  if (row.status !== "active") {
    throw new UserNotActiveError(row.id, row.status);
  }
}
