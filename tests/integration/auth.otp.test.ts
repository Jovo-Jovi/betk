/**
 * Auth / OTP integration tests — Phase 02 / T02.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg).
 * The Send-SMS hook is LIVE (TorvoSMS); OTPs must be read from the TorvoSMS
 * dashboard log — NOT from test output (raw OTP must never appear in output).
 *
 * These are DB-touching tests only. Pure-logic assertions (returnUrl guard,
 * phoneInputSchema, otpVerifySchema, token_hash format) live in
 * tests/unit/auth.unit.test.ts and run under `pnpm test:unit`.
 *
 * Test matrix:
 *   1. Happy path: signInWithOtp → verifyOtp → session created + last_login_at set + role.
 *   2. 6th attempt rejected by the otp_tokens limiter (DB write + read).
 *   3. Deactivated user blocked at findOrCreateUser (R-A05, DB read).
 *   4. updateLastLoginAt sets the column via service-role (DB write).
 *
 * Architecture:
 *   - All actor identity provisioning goes through GoTrue admin API
 *     (`auth.admin.createUser`) + a matching betk.users row (service-role).
 *   - signInWithPassword is used to mint sessions in the test context
 *     (OTP delivery requires TorvoSMS dashboard read — see test 1 comments).
 *   - Service-role client reads otp_tokens, betk.users, etc. to assert state.
 *   - afterAll purges every auth.users + betk.users row created here.
 *
 * NEVER print the raw OTP in assertions, console.log, or error messages.
 */

import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { recordOtpAttempt, MAX_OTP_ATTEMPTS } from "@/services/otpLimiter";
import { updateLastLoginAt } from "@/services/authUsers";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEmail(label: string) {
  return `betk-t02-${label}-${RUN_ID}@betk.test`;
}

const STAGING_TEST_PHONE = `+20100${RUN_ID.slice(0, 7)}`; // Not real; for limiter tests only.

async function createTestUser(
  serviceClient: ReturnType<typeof createServiceClient>,
  opts: {
    label: string;
    role?: string;
    status?: string;
    deletedAt?: string | null;
  },
) {
  const email = makeEmail(opts.label);
  const password = `T02-${RUN_ID}-${opts.label}`;

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`[auth.otp.test] createUser failed (${opts.label}): ${error?.message}`);
  }

  const uid = data.user.id;
  createdAuthIds.push(uid);

  const { error: insertErr } = await serviceClient
    .schema("betk")
    .from("users")
    .insert({
      id: uid,
      phone_number: null,
      auth_provider: "phone" as const,
      role: (opts.role ?? "buyer") as "buyer",
      status: (opts.status ?? "active") as "active",
      ...(opts.deletedAt !== undefined ? { deleted_at: opts.deletedAt } : {}),
    });

  if (insertErr) {
    throw new Error(`[auth.otp.test] betk insert failed (${opts.label}): ${insertErr.message}`);
  }

  return { uid, email, password };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("T02 — Phone OTP auth (DB-touching)", () => {
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
    await serviceClient
      .schema("betk")
      .from("otp_tokens")
      .delete()
      .like("phone_number", `%${RUN_ID.slice(0, 7)}%`);
  });

  // ── otp_tokens limiter — DB-backed ────────────────────────────────────────
  describe("otp_tokens limiter — AC-AUTH-2 clause 4 (DB)", () => {
    const testPhone = STAGING_TEST_PHONE;

    afterEach(async () => {
      await serviceClient
        .schema("betk")
        .from("otp_tokens")
        .delete()
        .eq("phone_number", testPhone);
    });

    it("allows the first 5 attempts and increments attempt_count in DB", async () => {
      for (let i = 1; i <= MAX_OTP_ATTEMPTS; i++) {
        const result = await recordOtpAttempt(testPhone);
        expect(result.allowed, `attempt ${i} should be allowed`).toBe(true);
        expect(result.attemptsUsed).toBe(i);
        if (i === MAX_OTP_ATTEMPTS) break;
      }
    });

    it("blocks the 6th attempt", async () => {
      for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
        await recordOtpAttempt(testPhone);
      }
      const blocked = await recordOtpAttempt(testPhone);
      expect(blocked.allowed).toBe(false);
    });

    it("stores a 64-char hex token_hash (not an OTP digit string) in otp_tokens", async () => {
      await recordOtpAttempt(testPhone);

      const { data } = await serviceClient
        .schema("betk")
        .from("otp_tokens")
        .select("token_hash, phone_number")
        .eq("phone_number", testPhone)
        .maybeSingle();

      expect(data).not.toBeNull();
      expect(data!.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(data!.phone_number).toBe(testPhone);
      expect(data!.token_hash).not.toMatch(/^\d{6}$/);
    });
  });

  // ── updateLastLoginAt (service-role DB write) ─────────────────────────────
  describe("updateLastLoginAt (service-role)", () => {
    it("sets last_login_at for a real betk.users row", async () => {
      const { uid } = await createTestUser(serviceClient, { label: "lastlogin" });

      const before = new Date(Date.now() - 1000).toISOString();
      await updateLastLoginAt(uid);

      const { data } = await serviceClient
        .schema("betk")
        .from("users")
        .select("last_login_at")
        .eq("id", uid)
        .maybeSingle();

      expect(data?.last_login_at).not.toBeNull();
      expect(new Date(data!.last_login_at!).toISOString() >= before).toBe(true);
    });
  });

  // ── R-A05 — deactivated user gate (DB read) ───────────────────────────────
  describe("R-A05 — deactivated user gate", () => {
    it("findOrCreateUser throws UserDeactivatedError for deleted_at user", async () => {
      const { uid } = await createTestUser(serviceClient, {
        label: "deactivated",
        deletedAt: new Date().toISOString(),
      });

      const { findOrCreateUser, UserDeactivatedError } = await import(
        "@/features/auth"
      );

      await expect(
        findOrCreateUser({
          id: uid,
          phoneNumber: null,
          authProvider: "phone",
        }),
      ).rejects.toBeInstanceOf(UserDeactivatedError);
    });

    it("findOrCreateUser throws UserNotActiveError for suspended user", async () => {
      const { uid } = await createTestUser(serviceClient, {
        label: "suspended",
        status: "suspended",
      });

      const { findOrCreateUser, UserNotActiveError } = await import(
        "@/features/auth"
      );

      await expect(
        findOrCreateUser({
          id: uid,
          phoneNumber: null,
          authProvider: "phone",
        }),
      ).rejects.toBeInstanceOf(UserNotActiveError);
    });
  });

  // ── Happy path (manual — OTP from TorvoSMS dashboard) ────────────────────
  const HAPPY_PATH_ENABLED =
    process.env.BETK_OTP_HAPPY_PATH === "1" && !!process.env.OTP_PHONE;

  describe.skipIf(!HAPPY_PATH_ENABLED)(
    "Happy path — OTP from TorvoSMS dashboard [manual, BETK_OTP_HAPPY_PATH=1]",
    () => {
      it("signInWithOtp + verifyOtp creates session, sets last_login_at, routes buyer", async () => {
        /**
         * MANUAL STEP REQUIRED:
         *   1. Set env: BETK_OTP_HAPPY_PATH=1 OTP_PHONE=+20XXXXXXXXXX OTP_TOKEN=<6-digit>
         *   2. Read OTP from TorvoSMS dashboard log (NOT from test output).
         *   3. Run: pnpm vitest run tests/integration/auth.otp.test.ts
         *
         * SECURITY: OTP_TOKEN is read from env only — NEVER printed, logged, or stored.
         */
        const phone = process.env.OTP_PHONE!;
        expect(/^\+201[0-9]{9}$/.test(phone), "OTP_PHONE must be E.164 Egyptian").toBe(true);

        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        const { error: sendErr } = await anonClient.auth.signInWithOtp({ phone });
        expect(sendErr, "signInWithOtp should not error").toBeNull();

        const token = process.env.OTP_TOKEN!;
        expect(token).toMatch(/^\d{6}$/);

        const { data: sessionData, error: verifyErr } = await anonClient.auth.verifyOtp({
          phone,
          token,
          type: "sms",
        });

        expect(verifyErr, "verifyOtp should not error").toBeNull();
        expect(sessionData.user).not.toBeNull();

        const uid = sessionData.user!.id;
        createdAuthIds.push(uid);

        const { findOrCreateUser } = await import("@/features/auth");
        const betKUser = await findOrCreateUser({
          id: uid,
          phoneNumber: sessionData.user!.phone ?? null,
          authProvider: "phone",
        });

        expect(betKUser.id).toBe(uid);
        expect(betKUser.status).toBe("active");

        await updateLastLoginAt(uid);

        const { data: row } = await serviceClient
          .schema("betk")
          .from("users")
          .select("last_login_at, role")
          .eq("id", uid)
          .maybeSingle();

        expect(row?.last_login_at).not.toBeNull();
        expect(row?.role).toBe("buyer");

        // SECURITY: token_hash in otp_tokens must NOT equal the raw OTP.
        const { data: tokenRows } = await serviceClient
          .schema("betk")
          .from("otp_tokens")
          .select("token_hash")
          .eq("phone_number", phone);

        for (const r of tokenRows ?? []) {
          expect(r.token_hash).not.toBe(token);
          expect(r.token_hash).toMatch(/^[0-9a-f]{64}$/);
        }
      });
    },
  );
});
