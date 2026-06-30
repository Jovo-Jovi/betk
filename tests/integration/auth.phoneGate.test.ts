/**
 * Verified-phone gate + phone-capture integration tests — Phase 02 / T07.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 *
 * Proves the app-layer half of the OD-4 phone gate end-to-end at the REAL
 * primitives (the Server Actions need a Next.js request context for
 * `getUser()`, so these exercise the gate core + the service-role write the
 * actions compose — same pattern as account.deactivate.test):
 *
 *   T07-a: a phone-NULL (Google) active user is BLOCKED by requireVerifiedPhone
 *          → PhoneRequiredError.
 *   T07-b: after the capture write (setUserPhoneNumber — what verifyPhoneOtp
 *          does on success), the SAME user PASSES the gate and the returned row
 *          carries the phone.
 *   T07-c: a duplicate-phone capture is rejected via the 23505 path
 *          (setUserPhoneNumber returns { conflict: "phone_taken" }) — NOT merely
 *          a pre-check SELECT — and the loser's phone_number stays NULL (no
 *          merge, no overwrite).
 *   T07-d: a DEACTIVATED user who already has a phone is STILL blocked by
 *          requireVerifiedPhone → UserDeactivatedError (proves the R-A05 half;
 *          R-A05 is checked before the phone check).
 *
 * Phase 02 / T07.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { deactivateAccount, setUserPhoneNumber } from "@/services/authUsers";
import {
  requireVerifiedPhoneForUser,
  PhoneRequiredError,
} from "@/features/auth/queries/requireVerifiedPhone";
import { UserDeactivatedError } from "@/features/auth/queries/findOrCreateUser";

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
  return `betk-t07-${label}-${RUN_ID}@betk.test`;
}

const TEST_PASSWORD = `Betk_${RUN_ID}_T07!`;

/** Deterministic-but-unique Egyptian-format phone per actor, per run. */
let phoneCounter = 0;
function makePhone() {
  const base = parseInt(RUN_ID.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2010${n.toString().padStart(8, "0")}`;
}

/**
 * Provision a GoTrue user + a betk.users row.
 *
 * @param phone  E.164 phone, or `null` for a Google-style phone-NULL account.
 */
async function createUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  label: string,
  phone: string | null,
) {
  const email = makeEmail(label);

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `[auth.phoneGate.test] createUser failed (${label}): ${error?.message}`,
    );
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  const { error: uErr } = await serviceClient
    .schema("betk")
    .from("users")
    .insert({
      id: uid,
      phone_number: phone,
      auth_provider: phone === null ? ("google" as const) : ("phone" as const),
    });

  if (uErr) {
    throw new Error(
      `[auth.phoneGate.test] users seed failed (${label}): ${uErr.message}`,
    );
  }

  return { uid, email, phone };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T07 — verified-phone gate + phone-capture (DB-touching)", () => {
  let serviceClient: ReturnType<typeof createServiceClient>;

  beforeAll(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const ref = extractProjectRef(url);

    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run phone-gate tests against project '${ref}'. ` +
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

  it("T07-a: requireVerifiedPhone BLOCKS a phone-NULL (Google) user (PhoneRequiredError)", async () => {
    const { uid } = await createUser(serviceClient, "null-blocked", null);

    await expect(requireVerifiedPhoneForUser(uid)).rejects.toBeInstanceOf(
      PhoneRequiredError,
    );
  });

  it("T07-b: after capture (setUserPhoneNumber), the SAME user PASSES the gate", async () => {
    const { uid } = await createUser(serviceClient, "capture-pass", null);
    const phone = makePhone();

    // Pre-state: blocked.
    await expect(requireVerifiedPhoneForUser(uid)).rejects.toBeInstanceOf(
      PhoneRequiredError,
    );

    // What verifyPhoneOtp does on a successful OTP verify.
    const result = await setUserPhoneNumber(uid, phone);
    expect(result).toEqual({ ok: true });

    // Post-state: passes, and the row carries the phone (auth_provider unchanged).
    const verified = await requireVerifiedPhoneForUser(uid);
    expect(verified.phone_number).toBe(phone);
    expect(verified.auth_provider).toBe("google"); // origin preserved
  });

  it("T07-c: duplicate-phone capture rejected via the 23505 path (not just pre-check); loser stays NULL", async () => {
    const sharedPhone = makePhone();
    const { uid: ownerId } = await createUser(
      serviceClient,
      "dup-owner",
      sharedPhone,
    );
    const { uid: loserId } = await createUser(serviceClient, "dup-loser", null);

    // The owner holds sharedPhone; the loser tries to capture the same number.
    // uq_users_phone → 23505 → { conflict: "phone_taken" } (write-time guard).
    const result = await setUserPhoneNumber(loserId, sharedPhone);
    expect(result).toEqual({ conflict: "phone_taken" });

    // No merge / no overwrite: the loser's phone stays NULL …
    const { data: loserRow } = await serviceClient
      .schema("betk")
      .from("users")
      .select("phone_number")
      .eq("id", loserId)
      .single();
    expect(loserRow!.phone_number).toBeNull();

    // … and the owner keeps the number.
    const { data: ownerRow } = await serviceClient
      .schema("betk")
      .from("users")
      .select("phone_number")
      .eq("id", ownerId)
      .single();
    expect(ownerRow!.phone_number).toBe(sharedPhone);
  });

  it("T07-d: a DEACTIVATED user WITH a phone is still blocked (R-A05 half — UserDeactivatedError)", async () => {
    const phone = makePhone();
    const { uid } = await createUser(serviceClient, "deact-phone", phone);

    // Sanity: with a phone + active, the gate passes.
    const verified = await requireVerifiedPhoneForUser(uid);
    expect(verified.phone_number).toBe(phone);

    // Deactivate → R-A05 must block even though a phone is present.
    await deactivateAccount(uid);

    await expect(requireVerifiedPhoneForUser(uid)).rejects.toBeInstanceOf(
      UserDeactivatedError,
    );
  });
});
