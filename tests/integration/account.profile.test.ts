/**
 * Account profile edit integration tests — Phase 02 / T05.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 *
 * These tests exercise the RLS path directly (the Server Action requires a
 * Next.js request context; we test the underlying Supabase client path that
 * the action uses). The pattern mirrors auth.profile.test.ts (T04):
 *   1. Provision a GoTrue user + betk.users + betk.buyer_profiles rows.
 *   2. Sign in via signInWithPassword (anon key client) → RLS-scoped context.
 *   3. Upsert buyer_profiles using the anon client → exercises bp_self policy.
 *   4. Assert field values updated.
 *
 * Matrix:
 *   T05-1: authenticated buyer can update buyer_profiles fields (full_name, city).
 *   T05-2: update does not affect betk.users (phone_number stays null — R-A06).
 *   T05-3: cross-user update is denied by bp_self RLS.
 *
 * Phase 02 / T05.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

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
  return `betk-t05-${label}-${RUN_ID}@betk.test`;
}

const TEST_PASSWORD = `Betk_${RUN_ID}_T05!`;

/**
 * Provision a GoTrue user + betk.users + betk.buyer_profiles seed row.
 */
async function createBuyerWithProfile(
  serviceClient: ReturnType<typeof createServiceClient>,
  label: string,
  initialName = "اسم تجريبي",
) {
  const email = makeEmail(label);

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`[account.profile.test] createUser failed (${label}): ${error?.message}`);
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  // Seed betk.users (service-role — no anon INSERT policy).
  const { error: uErr } = await serviceClient
    .schema("betk")
    .from("users")
    .insert({ id: uid, phone_number: null, auth_provider: "google" as const });

  if (uErr) {
    throw new Error(`[account.profile.test] users seed failed (${label}): ${uErr.message}`);
  }

  // Seed betk.buyer_profiles (service-role for test setup).
  const { error: bpErr } = await serviceClient
    .schema("betk")
    .from("buyer_profiles")
    .insert({ id: uid, full_name: initialName, governorate: "cairo" });

  if (bpErr) {
    throw new Error(
      `[account.profile.test] buyer_profiles seed failed (${label}): ${bpErr.message}`,
    );
  }

  return { uid, email };
}

/** Sign in and return the RLS-scoped anon client. */
async function signInAsUser(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createSupabaseClient<Database>(url, anonKey);

  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(`[account.profile.test] signIn failed: ${error.message}`);
  }

  return client;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T05 — account profile update (DB-touching / RLS)", () => {
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);

    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run account tests against project '${ref}'. ` +
          `Only these refs are allowed: ${STAGING_ALLOWLIST.join(", ")}. ` +
          `Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    serviceClient = createServiceClient();
  });

  afterAll(async () => {
    // FK-safe cleanup: buyer_profiles before users before auth.
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

  it("T05-1: authenticated buyer can update buyer_profiles fields", async () => {
    const { uid, email } = await createBuyerWithProfile(serviceClient, "editor");
    const userClient = await signInAsUser(email);

    // Update full_name and city via the RLS-scoped client (mirrors updateProfile action).
    const { error } = await userClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        {
          id: uid,
          full_name: "محمد إبراهيم الجديد",
          governorate: "giza",
          city: "الدقي",
        },
        { onConflict: "id" },
      );

    expect(error).toBeNull();

    // Verify updated values via service client.
    const { data: row } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("full_name, governorate, city")
      .eq("id", uid)
      .single();

    expect(row!.full_name).toBe("محمد إبراهيم الجديد");
    expect(row!.governorate).toBe("giza");
    expect(row!.city).toBe("الدقي");
  });

  it("T05-2: update to buyer_profiles does not modify betk.users (phone stays null — R-A06)", async () => {
    const { uid, email } = await createBuyerWithProfile(serviceClient, "readonly-phone");
    const userClient = await signInAsUser(email);

    // Upsert buyer_profiles (this is the only write the action performs).
    await userClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        { id: uid, full_name: "فاطمة السيد", governorate: "alexandria" },
        { onConflict: "id" },
      );

    // betk.users.phone_number must remain NULL — updateProfile never touches users.
    const { data: userRow } = await serviceClient
      .schema("betk")
      .from("users")
      .select("phone_number, auth_provider")
      .eq("id", uid)
      .single();

    expect(userRow!.phone_number).toBeNull();
    expect(userRow!.auth_provider).toBe("google");
  });

  it("T05-3: RLS blocks a buyer updating buyer_profiles for a DIFFERENT user's id", async () => {
    const { uid: victimId } = await createBuyerWithProfile(
      serviceClient,
      "victim2",
      "الضحية",
    );
    const { email: attackerEmail } = await createBuyerWithProfile(
      serviceClient,
      "attacker2",
      "المهاجم",
    );
    const attackerClient = await signInAsUser(attackerEmail);

    // Attacker tries to overwrite victim's profile.
    const { error } = await attackerClient
      .schema("betk")
      .from("buyer_profiles")
      .upsert(
        { id: victimId, full_name: "مزيف", governorate: "cairo" },
        { onConflict: "id" },
      );

    // bp_self USING (id = auth.uid() OR is_admin()) → denied for non-owner.
    expect(error).not.toBeNull();

    // Victim's original name is unchanged.
    const { data: row } = await serviceClient
      .schema("betk")
      .from("buyer_profiles")
      .select("full_name")
      .eq("id", victimId)
      .single();

    expect(row!.full_name).toBe("الضحية");
  });
});
