/**
 * Account deactivation integration tests — Phase 02 / T06 (OD-2).
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 *
 * Proves the deactivation contract + that the R-A05 loop closes at the REAL
 * gate (not merely a middleware redirect):
 *   T06-1: deactivateAccount(uid) sets ONLY deleted_at — role/status/phone_number
 *          unchanged, anonymized_at stays NULL (no anonymization in MVP).
 *   T06-2: after deactivation, findOrCreateUser (the verify/callback re-check)
 *          REJECTS the identity with UserDeactivatedError — a deactivated user
 *          cannot transact back in. This is the real gate, not middleware.
 *   T06-3: deactivation is scoped to the target id only — deactivating user A
 *          leaves user B's deleted_at NULL (action only ever sets auth.uid()).
 *
 * The Server Action requires a Next.js request context; these tests exercise
 * the underlying service-role helper + the R-A05 primitive the action composes.
 *
 * Phase 02 / T06.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { deactivateAccount } from "@/services/authUsers";
import {
  findOrCreateUser,
  UserDeactivatedError,
} from "@/features/auth/queries/findOrCreateUser";

// ---------------------------------------------------------------------------
// Runtime gating
// ---------------------------------------------------------------------------
const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (
  process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function extractProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
const RUN_ID = randomUUID().slice(0, 8);
const createdAuthIds: string[] = [];

function makeEmail(label: string) {
  return `betk-t06-${label}-${RUN_ID}@betk.test`;
}

const TEST_PASSWORD = `Betk_${RUN_ID}_T06!`;

/** Deterministic-but-unique Egyptian-format phone per actor, per run. */
let phoneCounter = 0;
function makePhone() {
  // 010 + 8 digits derived from the run id + a per-actor counter.
  const base = parseInt(RUN_ID.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2010${n.toString().padStart(8, "0")}`;
}

/**
 * Provision a GoTrue user + an ACTIVE betk.users row (phone provider).
 */
async function createActiveUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  label: string,
) {
  const email = makeEmail(label);
  const phone = makePhone();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `[account.deactivate.test] createUser failed (${label}): ${error?.message}`,
    );
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  const { error: uErr } = await serviceClient
    .schema("betk")
    .from("users")
    .insert({ id: uid, phone_number: phone, auth_provider: "phone" as const });

  if (uErr) {
    throw new Error(
      `[account.deactivate.test] users seed failed (${label}): ${uErr.message}`,
    );
  }

  return { uid, email, phone };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T06 — account deactivation (DB-touching / R-A05 loop)", () => {
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);

    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run deactivation tests against project '${ref}'. ` +
          `Only these refs are allowed: ${STAGING_ALLOWLIST.join(", ")}. ` +
          `Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    serviceClient = createServiceClient();
  });

  afterAll(async () => {
    for (const id of createdAuthIds) {
      await serviceClient.schema("betk").from("users").delete().eq("id", id);
      await serviceClient.auth.admin.deleteUser(id);
    }
  });

  it("T06-1: deactivateAccount sets ONLY deleted_at (role/status/phone unchanged, anonymized_at stays NULL)", async () => {
    const { uid, phone } = await createActiveUser(serviceClient, "scope-cols");

    await deactivateAccount(uid);

    const { data: row } = await serviceClient
      .schema("betk")
      .from("users")
      .select("deleted_at, anonymized_at, role, status, phone_number, auth_provider")
      .eq("id", uid)
      .single();

    // deleted_at stamped …
    expect(row!.deleted_at).not.toBeNull();
    // … and nothing else touched.
    expect(row!.anonymized_at).toBeNull(); // OD-2: no anonymization in MVP
    expect(row!.role).toBe("buyer");
    expect(row!.status).toBe("active"); // status NOT flipped — R-A05 keys on deleted_at
    expect(row!.phone_number).toBe(phone);
    expect(row!.auth_provider).toBe("phone");
  });

  it("T06-2: R-A05 re-check — findOrCreateUser REJECTS a deactivated user (cannot transact back in)", async () => {
    const { uid, phone } = await createActiveUser(serviceClient, "ra05-loop");

    // Deactivate (what the Server Action does for auth.uid()).
    await deactivateAccount(uid);

    // Subsequent auth attempt hits the SAME primitive that verifyOtp /
    // /auth/callback call — this is the real gate, proving the loop closes
    // beyond a middleware redirect.
    await expect(
      findOrCreateUser({
        id: uid,
        phoneNumber: phone,
        authProvider: "phone",
      }),
    ).rejects.toBeInstanceOf(UserDeactivatedError);

    // deleted_at must NOT be cleared by the re-auth attempt (never resurrected).
    const { data: row } = await serviceClient
      .schema("betk")
      .from("users")
      .select("deleted_at")
      .eq("id", uid)
      .single();
    expect(row!.deleted_at).not.toBeNull();
  });

  it("T06-3: deactivation is scoped to the target id only (action sets auth.uid() alone)", async () => {
    const { uid: aId } = await createActiveUser(serviceClient, "scope-a");
    const { uid: bId } = await createActiveUser(serviceClient, "scope-b");

    await deactivateAccount(aId);

    const { data: bRow } = await serviceClient
      .schema("betk")
      .from("users")
      .select("deleted_at")
      .eq("id", bId)
      .single();

    // Deactivating A must never affect B.
    expect(bRow!.deleted_at).toBeNull();
  });
});
