/**
 * requireAdmin — the canonical admin-role gate (Phase 07 / T02b).
 *
 * This is the APP-LAYER mirror of the DB `betk.is_admin()` authority. It is NOT a
 * second source of truth: `is_admin()` is `role IN ('admin','superadmin') AND
 * status='active'` (BETK_DATABASE_SCHEMA L1042), and this gate applies EXACTLY
 * those conditions against the same `betk.users` row (loaded fresh via the shared
 * `getUserRowById` helper). It exists so admin-gated Server Actions + routes
 * (confirmDepositPayment here; /admin/payments at T05) call ONE gate rather than
 * re-checking role inline.
 *
 * It reuses the AuthUserError family (deactivated / not-active / not-authenticated)
 * so callers route rejections uniformly, and adds `NotAdminError` for the
 * role-fails-but-account-active case (an authenticated non-admin → the route's
 * spec'd rejection, e.g. hard 404 at T05).
 *
 * Ordering mirrors requireActiveUserForUser: deactivated → not-active → THEN the
 * admin-role check (a deactivated admin is blocked as deactivated, never admitted).
 *
 * Per ADR-010 (Model A, GoTrue-canonical). SERVER ONLY.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUserRowById } from "@/services/authUsers";
import { AuthUserError, UserDeactivatedError, UserNotActiveError } from "./findOrCreateUser";
import { NotAuthenticatedError } from "./requireVerifiedPhone";
import type { Database } from "@/lib/supabase/types";
import type { UserRole } from "@/constants/enums";

type UserRow = Database["betk"]["Tables"]["users"]["Row"];

/** The account is active but is not an admin/superadmin. Route to the spec'd rejection. */
export class NotAdminError extends AuthUserError {
  constructor(
    public readonly userId: string,
    public readonly role: UserRole,
  ) {
    super(`User is not an admin (role='${role}').`);
    this.name = "NotAdminError";
  }
}

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["admin", "superadmin"]);

/**
 * Core admin gate keyed to an explicit, session-verified user id. Mirrors
 * `betk.is_admin()` verbatim (role ∈ {admin,superadmin} AND status='active').
 *
 * @throws {UserDeactivatedError | UserNotActiveError | NotAdminError | NotAuthenticatedError}
 */
export async function requireAdminForUser(userId: string): Promise<UserRow> {
  const row = await getUserRowById(userId);
  if (!row) throw new NotAuthenticatedError();

  if (row.deleted_at !== null) throw new UserDeactivatedError(row.id);
  if (row.status !== "active") throw new UserNotActiveError(row.id, row.status);
  if (!ADMIN_ROLES.has(row.role)) throw new NotAdminError(row.id, row.role);

  return row;
}

/**
 * Canonical admin gate — reads the current user from the live GoTrue session,
 * then delegates to {@link requireAdminForUser}.
 *
 * @throws {NotAuthenticatedError} when there is no session.
 * @throws {UserDeactivatedError | UserNotActiveError} when R-A05 blocks the user.
 * @throws {NotAdminError} when the (active) caller is not an admin.
 */
export async function requireAdmin(): Promise<UserRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new NotAuthenticatedError();

  return requireAdminForUser(user.id);
}
