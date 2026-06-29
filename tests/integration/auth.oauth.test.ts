/**
 * Google OAuth find-or-create integration tests — Phase 02 / T03.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 *
 * The OAuth callback route itself (code exchange) cannot be exercised headlessly
 * without a live Google consent flow + PKCE cookie. These tests cover the part
 * the callback owns and that carries the security weight: the find-or-create
 * primitive driven exactly as the callback drives it for a Google identity —
 *   authProvider='google', phoneNumber=NULL, matched strictly on auth.users.id.
 *
 * Matrix:
 *   1. New Google user      → ONE betk.users row, auth_provider='google', phone NULL.
 *   2. Returning Google user → re-running find-or-create does NOT duplicate.
 *   3. Deactivated Google user → R-A05 blocks (UserDeactivatedError), not resurrected.
 *
 * Architecture (mirrors auth.otp.test.ts):
 *   - Auth identities are provisioned through GoTrue admin (`auth.admin.createUser`).
 *   - The service-role client reads/writes betk.users to assert state.
 *   - afterAll purges every auth.users + betk.users row created here.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// Runtime gating — skip cleanly when staging credentials are absent
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

/** Auth users created in this run — purged in afterAll (betk row deleted by same id). */
const createdAuthIds: string[] = [];

function makeEmail(label: string) {
  return `betk-t03-${label}-${RUN_ID}@betk.test`;
}

/**
 * Provision a GoTrue auth identity (simulating a Google sign-in). Returns the uid.
 * Does NOT create the betk.users row — find-or-create owns that. Pass
 * `seedBetkRow` to pre-create the mirror row (used by the deactivated case).
 */
async function createGoogleAuthUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  label: string,
  seedBetkRow?: { deletedAt?: string | null; status?: string },
) {
  const email = makeEmail(label);

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`[auth.oauth.test] createUser failed (${label}): ${error?.message}`);
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  if (seedBetkRow) {
    const { error: insertErr } = await serviceClient
      .schema("betk")
      .from("users")
      .insert({
        id: uid,
        phone_number: null,
        auth_provider: "google" as const,
        status: (seedBetkRow.status ?? "active") as "active",
        ...(seedBetkRow.deletedAt !== undefined
          ? { deleted_at: seedBetkRow.deletedAt }
          : {}),
      });

    if (insertErr) {
      throw new Error(`[auth.oauth.test] betk seed failed (${label}): ${insertErr.message}`);
    }
  }

  return { uid, email };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T03 — Google OAuth find-or-create (DB-touching)", () => {
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);

    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run auth tests against project '${ref}'. ` +
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

  it("new Google user → creates ONE betk.users row, auth_provider='google', phone NULL", async () => {
    const { uid } = await createGoogleAuthUser(serviceClient, "newuser");
    const { findOrCreateUser } = await import("@/features/auth");

    const row = await findOrCreateUser({
      id: uid,
      phoneNumber: null,
      authProvider: "google",
    });

    expect(row.id).toBe(uid);
    expect(row.auth_provider).toBe("google");
    expect(row.phone_number).toBeNull();
    expect(row.status).toBe("active");

    // Exactly one row mirrors this identity.
    const { count } = await serviceClient
      .schema("betk")
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("id", uid);

    expect(count).toBe(1);
  });

  it("returning Google user → re-running find-or-create does NOT duplicate", async () => {
    const { uid } = await createGoogleAuthUser(serviceClient, "returning");
    const { findOrCreateUser } = await import("@/features/auth");

    const first = await findOrCreateUser({
      id: uid,
      phoneNumber: null,
      authProvider: "google",
    });
    const second = await findOrCreateUser({
      id: uid,
      phoneNumber: null,
      authProvider: "google",
    });

    expect(first.id).toBe(uid);
    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);

    // Still exactly one row — no duplicate created on the second sign-in.
    const { count } = await serviceClient
      .schema("betk")
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("id", uid);

    expect(count).toBe(1);
  });

  it("deactivated Google user → R-A05 blocks (UserDeactivatedError), not resurrected", async () => {
    const { uid } = await createGoogleAuthUser(serviceClient, "deactivated", {
      deletedAt: new Date().toISOString(),
    });

    const { findOrCreateUser, UserDeactivatedError } = await import(
      "@/features/auth"
    );

    await expect(
      findOrCreateUser({
        id: uid,
        phoneNumber: null,
        authProvider: "google",
      }),
    ).rejects.toBeInstanceOf(UserDeactivatedError);

    // The row is still flagged deactivated — find-or-create must never clear deleted_at.
    const { data } = await serviceClient
      .schema("betk")
      .from("users")
      .select("deleted_at")
      .eq("id", uid)
      .maybeSingle();

    expect(data?.deleted_at).not.toBeNull();
  });
});
