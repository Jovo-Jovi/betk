/**
 * Buyer profile creation integration tests — Phase 02 / T04.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 *
 * These tests exercise the RLS path directly (not via the Server Action, which
 * requires a Next.js request context). The test:
 *   1. Provisions a GoTrue user + betk.users row via the service client.
 *   2. Signs the user in via `signInWithPassword` (anon key client) so the
 *      authenticated session is established.
 *   3. Upserts buyer_profiles using the RLS-scoped anon client — this exercises
 *      the `bp_self` policy (PERMISSIVE FOR ALL USING id = auth.uid()) exactly
 *      as `completeProfile` does in production.
 *   4. Asserts the row exists with id = users.id, expected field values.
 *   5. Verifies an upsert (idempotent re-run) does not create a second row.
 *
 * Matrix:
 *   1. New buyer → buyer_profiles row created, id = users.id.
 *   2. Upsert is idempotent → only one row; fields update correctly.
 *   3. Cross-user write attempt → RLS denies (403 / 0 rows affected).
 *
 * Architecture (mirrors auth.oauth.test.ts):
 *   - Auth identities provisioned via GoTrue admin.
 *   - Service client for setup + assertions; anon client for RLS-scoped writes.
 *   - afterAll purges all created rows.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

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

/** Auth users created in this run — purged in afterAll. */
const createdAuthIds: string[] = [];

function makeEmail(label: string) {
  return `betk-t04-${label}-${RUN_ID}@betk.test`;
}

const TEST_PASSWORD = `Betk_${RUN_ID}_T04!`;

/**
 * Provision a GoTrue auth user (email+password) + betk.users mirror row.
 * Returns { uid, email }.
 */
async function createBuyerUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  label: string,
) {
  const email = makeEmail(label);

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`[auth.profile.test] createUser failed (${label}): ${error?.message}`);
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  // Mirror into betk.users (service-role because users has no anon INSERT policy).
  const { error: insertErr } = await serviceClient
    .schema("betk")
    .from("users")
    .insert({
      id: uid,
      phone_number: null,
      auth_provider: "google" as const,
    });

  if (insertErr) {
    throw new Error(`[auth.profile.test] betk.users seed failed (${label}): ${insertErr.message}`);
  }

  return { uid, email };
}

/**
 * Sign in as a user and return the anon (RLS-scoped) client.
 */
async function signInAsUser(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createSupabaseClient<Database>(url, anonKey);

  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(`[auth.profile.test] signIn failed: ${error.message}`);
  }

  return client;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T04 — buyer profile creation (DB-touching / RLS)", () => {
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);

    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run profile tests against project '${ref}'. ` +
          `Only these refs are allowed: ${STAGING_ALLOWLIST.join(", ")}. ` +
          `Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    serviceClient = createServiceClient();
  });

  afterAll(async () => {
    // Clean up in FK-safe order: buyer_profiles first (references users).
    for (const id of createdAuthIds) {
      await serviceClient
        .schema("betk")
        .from("buyer_profiles")
        .delete()
        .eq("id", id);
      await serviceClient.schema("betk").from("users").delete().eq("id", id);
      await serviceClient.auth.admin.deleteUser(id);
    }
  });

  it("T04-1: authenticated buyer can insert buyer_profiles with id = auth.uid()", async () => {
    const { uid, email } = await createBuyerUser(serviceClient, "buyer-a");
    const userClient = await signInAsUser(email);

    // Upsert via RLS-scoped client — exercises bp_self policy.
    const { error } = await userClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        { id: uid, full_name: "محمد أحمد", governorate: "cairo" },
        { onConflict: "id" },
      );

    expect(error).toBeNull();

    // Assert the row exists with expected values (service client for clarity).
    const { data: row } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("*")
      .eq("id", uid)
      .single();

    expect(row).not.toBeNull();
    expect(row!.id).toBe(uid);
    expect(row!.full_name).toBe("محمد أحمد");
    expect(row!.governorate).toBe("cairo");
    expect(row!.city).toBeNull();
  });

  it("T04-2: upsert is idempotent — second call updates fields, no duplicate row", async () => {
    const { uid, email } = await createBuyerUser(serviceClient, "buyer-b");
    const userClient = await signInAsUser(email);

    // First insert.
    await userClient.schema("betk").from("buyer_profiles").upsert(
      { id: uid, full_name: "فاطمة علي", governorate: "giza" },
      { onConflict: "id" },
    );

    // Second upsert — updates name + adds city.
    const { error } = await userClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        { id: uid, full_name: "فاطمة محمد علي", governorate: "giza", city: "مدينة نصر" },
        { onConflict: "id" },
      );

    expect(error).toBeNull();

    // Exactly ONE row.
    const { count } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", uid);

    expect(count).toBe(1);

    const { data: row } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("full_name, city")
      .eq("id", uid)
      .single();

    expect(row!.full_name).toBe("فاطمة محمد علي");
    expect(row!.city).toBe("مدينة نصر");
  });

  it("T04-3: RLS blocks a buyer writing buyer_profiles for a DIFFERENT user's id", async () => {
    const { uid: victimId } = await createBuyerUser(serviceClient, "victim");
    const { email: attackerEmail } = await createBuyerUser(serviceClient, "attacker");
    const attackerClient = await signInAsUser(attackerEmail);

    // Attacker tries to create/overwrite victim's profile.
    const { error } = await attackerClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        { id: victimId, full_name: "مزيف", governorate: "cairo" },
        { onConflict: "id" },
      );

    // bp_self USING (id = auth.uid() OR is_admin()) → attacker's auth.uid() != victimId
    // → insert is denied. Supabase/PostgREST returns an error or 0 rows.
    const isDenied = error !== null;
    expect(isDenied).toBe(true);

    // Verify victim's profile was NOT created.
    const { data: row } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("id")
      .eq("id", victimId)
      .maybeSingle();

    expect(row).toBeNull();
  });
});
