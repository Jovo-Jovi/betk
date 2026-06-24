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
