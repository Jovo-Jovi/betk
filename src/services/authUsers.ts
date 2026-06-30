/**
 * Trusted provisioning layer for `betk.users` — SERVER ONLY.
 *
 * Why this lives in `src/services/` (not `src/features/auth`): `betk.users` has
 * RLS enabled with ONLY `users_self (FOR SELECT)` — there is no permissive
 * INSERT/UPDATE policy (ERD §3: "users INSERT = (Supabase Auth)"). The
 * authenticated cookie client can therefore read its own row but cannot create
 * it. The CREATE branch must run through the service-role client, which is only
 * importable from `src/services/` per the `check-service-import` CI guard.
 *
 * SECURITY: every write here is keyed to a caller-verified `auth.users.id`. The
 * caller (the T01 find-or-create primitive) passes the id it read from the live
 * GoTrue session — this layer NEVER trusts a client-supplied id and NEVER
 * exposes the service client or its raw results without that guarantee.
 *
 * Per ADR-010 (Model A, GoTrue-canonical).
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type UserRow = Database["betk"]["Tables"]["users"]["Row"];
type AuthProvider = Database["betk"]["Enums"]["auth_provider"];

/** Postgres unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

export interface InsertUserRowInput {
  /** Verified GoTrue auth.users.id — used verbatim as betk.users.id. */
  id: string;
  /** E.164-ish digits, or null for Google identities. */
  phoneNumber: string | null;
  authProvider: AuthProvider;
}

/**
 * Result of an insert attempt. Expected conflicts are returned (not thrown) so
 * the orchestrating primitive can interpret them; unexpected DB errors throw.
 *
 * - `id_race`     — a concurrent request already created this id; re-fetch wins.
 * - `phone_taken` — the phone_number UNIQUE constraint rejected a DIFFERENT id
 *                   (data-integrity / account-collision signal; T07 cares).
 */
export type InsertUserRowResult =
  | { row: UserRow }
  | { conflict: "id_race" | "phone_taken" };

/** Read a `betk.users` row by primary key. Returns null when absent. */
export async function getUserRowById(id: string): Promise<UserRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`[authUsers] select by id failed: ${error.message}`);
  }
  return data;
}

/**
 * Set `betk.users.last_login_at = now()` for the given verified user id.
 *
 * `betk.users` has no permissive UPDATE policy (ADR-010 finding / T02 carry-forward).
 * This must run via the service-role client. The id MUST be a verified GoTrue uid
 * (never trust a client-supplied value — callers pass the id from a live session).
 *
 * FINDING (surfaced per ADR-010): a scoped permissive self-UPDATE policy would allow
 * the authenticated cookie client to set last_login_at without the service key.
 * Not added silently — flag for review at the T06 (deactivate) gate.
 */
export async function updateLastLoginAt(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .schema("betk")
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`[authUsers] updateLastLoginAt failed: ${error.message}`);
  }
}

/**
 * Deactivate a user account (OD-2, DEACTIVATE-only) — set `deleted_at = now()`.
 *
 * SCOPE (security-critical, Phase 02 / T06): this update sets EXACTLY ONE column,
 * `deleted_at`. It NEVER touches `anonymized_at` (reserved, post-MVP — no MVP
 * behaviour), NEVER `role` / `status` / `phone_number` / any other column, and
 * NEVER another user's row — the caller passes `id` read from the live GoTrue
 * session (`auth.uid()`), never a client-supplied value.
 *
 * WHY service-role (DECISION — Option A, T06): `betk.users` has only a
 * `users_self` SELECT policy and no permissive UPDATE policy, while the
 * table-level GRANT to `authenticated` already covers UPDATE on ALL columns.
 * A scoped permissive UPDATE policy (Option B) would therefore combine with that
 * all-column grant to permit `role`/`status`/`phone_number` self-rewrites
 * (privilege escalation) unless the grant were first revoked and re-issued as
 * `GRANT UPDATE(deleted_at, anonymized_at)` — a whole-table grant change that
 * also prematurely opens `anonymized_at`. The service-role path keeps the write
 * column-scoped in code with zero schema/grant change and leaves RLS as the
 * authz boundary. This consistency mirrors `updateLastLoginAt`.
 *
 * Idempotent: re-deactivating simply re-stamps `deleted_at`.
 */
export async function deactivateAccount(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .schema("betk")
    .from("users")
    // Only `deleted_at`. Do NOT add any other column here.
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`[authUsers] deactivateAccount failed: ${error.message}`);
  }
}

/**
 * Result of a phone-capture write (Phase 02 / T07).
 *
 * - `ok`          — phone_number written for the verified user.
 * - `phone_taken` — the `uq_users_phone` UNIQUE constraint rejected the write
 *                   because the number already belongs to a DIFFERENT account.
 *                   Returned (not thrown) so the action can surface a clean
 *                   "number already in use" message. We NEVER merge accounts.
 */
export type SetUserPhoneNumberResult = { ok: true } | { conflict: "phone_taken" };

/**
 * Write `betk.users.phone_number` for a Google-only user who has verified a new
 * phone via OTP (Phase 02 / T07 phone-capture).
 *
 * SCOPE (security-critical): sets EXACTLY ONE column, `phone_number`. It NEVER
 * touches `auth_provider` — that stays 'google' (it records origin, not current
 * capability) — and NEVER `role`/`status`/`deleted_at`/any other column, and
 * NEVER another user's row (the caller passes `id` read from the live GoTrue
 * session, never a client-supplied value).
 *
 * WHY service-role (T06 settled precedent, mirrors `deactivateAccount` /
 * `updateLastLoginAt`): `betk.users` has only a `users_self` SELECT policy and
 * NO permissive UPDATE policy, while the table-level GRANT to `authenticated`
 * covers UPDATE on ALL columns — so a scoped self-UPDATE policy would be a
 * privilege-escalation vector until that grant is revoked + re-scoped. The
 * service-role path keeps the write column-scoped in code with zero schema
 * change and leaves RLS as the authz boundary.
 *
 * COLLISION HANDLING (mandatory, NOT a pre-check): `uq_users_phone` is the real
 * guard against two accounts claiming one number. We catch the Postgres
 * unique-violation (23505) at WRITE time and return `{ conflict: "phone_taken" }`
 * rather than relying on a pre-check SELECT (which carries a TOCTOU race). A
 * pre-check is fine as UX, but this 23505 catch is the authoritative guard.
 *
 * The `id` MUST be a verified GoTrue uid.
 */
export async function setUserPhoneNumber(
  id: string,
  phoneNumber: string,
): Promise<SetUserPhoneNumberResult> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .schema("betk")
    .from("users")
    // Only `phone_number`. Do NOT add any other column here — auth_provider
    // stays 'google'; role/status/deleted_at are never touched.
    .update({ phone_number: phoneNumber })
    .eq("id", id);

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      // uq_users_phone rejected: the number belongs to another account.
      return { conflict: "phone_taken" };
    }
    throw new Error(`[authUsers] setUserPhoneNumber failed: ${error.message}`);
  }
  return { ok: true };
}

/**
 * UX pre-check: is `phoneNumber` already taken by ANY `betk.users` row?
 *
 * This is a best-effort convenience so the phone-capture flow can avoid sending
 * an OTP to a number that is already in use. It is NOT the authoritative guard
 * (a TOCTOU race exists between this SELECT and the later write) — the real
 * guard is the `uq_users_phone` 23505 catch in `setUserPhoneNumber`.
 */
export async function isPhoneNumberTaken(phoneNumber: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("users")
    .select("id")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`[authUsers] isPhoneNumberTaken failed: ${error.message}`);
  }
  return data !== null;
}

/**
 * Resolve the post-auth redirect destination for a given user.
 *
 * - admin/superadmin → /admin
 * - seller: seller_profiles.status non-active (R-S04) → /seller/status; active → /seller
 * - buyer: no buyer_profiles row (first sign-in) → /auth/register; else → returnUrl|'/'
 *
 * Uses the service-role client because the authenticated cookie client may not
 * yet have the session cookie set when this is called inside verifyOtp.
 */
export async function resolvePostAuthRedirect(
  userId: string,
  role: string,
  returnUrl: string,
): Promise<string> {
  const supabase = createServiceClient();

  if (role === "admin" || role === "superadmin") {
    return "/admin";
  }

  if (role === "seller") {
    const { data: sp } = await supabase
      .schema("betk")
      .from("seller_profiles")
      .select("status")
      .eq("id", userId)
      .maybeSingle();

    if (!sp || sp.status !== "active") return "/seller/status";
    return "/seller";
  }

  // buyer — check for buyer_profile (T04: missing → registration required).
  const { data: bp } = await supabase
    .schema("betk")
    .from("buyer_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!bp) return "/auth/register";

  // Safe returnUrl already validated by the caller.
  return returnUrl || "/";
}

/**
 * Check whether a `betk.buyer_profiles` row exists for the given user id.
 *
 * Uses the service-role client so it can be called immediately after session
 * creation (the GoTrue cookie may not yet be available in the RSC render
 * context for a freshly-established session). This is a read-only check used
 * by the /auth/register page to decide whether to show or skip the form.
 *
 * Returns true when the row exists, false otherwise.
 */
export async function hasBuyerProfile(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("buyer_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[authUsers] hasBuyerProfile failed: ${error.message}`);
  }
  return data !== null;
}

/**
 * Insert a new `betk.users` row mirroring a GoTrue identity. `role`, `status`,
 * `created_at`, `updated_at` use DB defaults ('buyer' / 'active' / now()).
 */
export async function insertUserRow(
  input: InsertUserRowInput,
): Promise<InsertUserRowResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("betk")
    .from("users")
    .insert({
      id: input.id,
      phone_number: input.phoneNumber,
      auth_provider: input.authProvider,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      // Distinguish an id race (same identity inserted concurrently) from a
      // phone_number collision against a different account.
      const existing = await getUserRowById(input.id);
      return existing ? { conflict: "id_race" } : { conflict: "phone_taken" };
    }
    throw new Error(`[authUsers] insert failed: ${error.message}`);
  }
  return { row: data };
}
