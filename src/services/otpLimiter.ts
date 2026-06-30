/**
 * OTP attempt limiter — AC-AUTH-2 clause 4 ("≤5 attempts per token").
 *
 * GoTrue does NOT track per-token failed attempts — it only has per-IP
 * throttling (ADR-010 §4). This service provides the app-layer ≤5-attempt
 * counter backed by `betk.otp_tokens`, and is the SOLE owner of AC-AUTH-2
 * clause 4.
 *
 * LIFECYCLE-ANCHORED (Phase 02 / T08-FIX, open-issue #12)
 * ------------------------------------------------------
 * The counter is anchored to ONE OTP issuance, NOT to a wall-clock window:
 *   • At SEND time the caller invokes `createOtpChallenge(phone)` which inserts
 *     exactly one row with `expires_at = now + 60s` (the OTP lifetime) and
 *     `attempt_count = 0`, after superseding any still-active row for the phone.
 *   • At VERIFY time `recordOtpAttempt(phone)` selects the active row
 *     (`expires_at > now AND is_used = false`) and increments THAT row.
 * Because the same row serves the whole 60s OTP lifetime, attempts cannot
 * "reset" by crossing a 60s epoch boundary — the defect fixed here, where an
 * absolute wall-clock bucket let a mid-bucket OTP straddle two counters and earn
 * ~10 attempts on one valid code.
 *
 * OVERLAPPING-ROWS RULE (deterministic): GoTrue `SMS_MAX_FREQUENCY = 60s`
 * normally prevents two live OTPs per phone, but to be deterministic on resend
 * edge cases: (a) `createOtpChallenge` supersedes (marks `is_used = true`) every
 * prior active row before inserting the new one, and (b) `recordOtpAttempt`
 * selects the MOST RECENT active row (highest `expires_at`). So at most one row
 * is ever counted, and it is always the freshest issuance.
 *
 * Security contract (NEVER violate):
 *   • NEVER store the raw OTP anywhere in this file or its callers.
 *   • `token_hash` is an opaque random server nonce (NOT derived from the OTP,
 *     NOT used for lookup) — retained only to satisfy the NOT NULL column and as
 *     an audit id.
 *   • The DB `CHECK(attempt_count <= 5)` (`chk_otp_attempts`) is the hard
 *     backstop; the logic here stops at 5 before writing.
 *   • `attempt_count` increments BEFORE calling GoTrue so a timeout / wrong code
 *     cannot grant a free extra attempt.
 *
 * Table: betk.otp_tokens (service-only — no client-readable RLS policy).
 * Cleanup: hourly pg_cron `cleanup-otp-tokens` purges expired rows.
 *
 * SERVER ONLY — uses the service-role client.
 */

import "server-only";
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/** Maximum allowed verify attempts per OTP challenge (AC-AUTH-2). */
export const MAX_OTP_ATTEMPTS = 5;

/** OTP TTL in seconds (R-A02 / GoTrue SMS_OTP_EXP = 60). */
const OTP_TTL_SECONDS = 60;

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Generate an opaque 64-char hex server nonce for `token_hash`.
 *
 * This is NOT derived from the OTP and is NOT used to look up the row (lookup is
 * by phone + active-window). It exists only to satisfy the `token_hash NOT NULL`
 * column and to give each challenge an audit-distinct value.
 */
function newTokenHash(): string {
  return randomBytes(32).toString("hex");
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface OtpLimiterResult {
  /** Whether the attempt is allowed (the active challenge had < MAX attempts). */
  allowed: boolean;
  /** attempt_count AFTER this call (1 = first attempt; 0 = no active challenge). */
  attemptsUsed: number;
}

/**
 * Open an OTP challenge for `phone` — call this at SEND time, AFTER GoTrue has
 * successfully issued the OTP (`signInWithOtp` / `updateUser({ phone })`).
 *
 * Inserts exactly one `otp_tokens` row anchored to the OTP lifetime
 * (`expires_at = now + 60s`, `attempt_count = 0`, `is_used = false`), after
 * superseding any prior still-active row for the phone (so only the freshest
 * issuance is ever counted — see the OVERLAPPING-ROWS RULE).
 *
 * SERVER ONLY (service-role; `betk.otp_tokens` has no client-writable policy).
 */
export async function createOtpChallenge(phone: string): Promise<void> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  // Supersede any still-active challenge for this phone (resend edge case).
  const { error: supersedeErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .update({ is_used: true })
    .eq("phone_number", phone)
    .eq("is_used", false)
    .gt("expires_at", nowIso);

  if (supersedeErr) {
    throw new Error(`[otpLimiter] supersede failed: ${supersedeErr.message}`);
  }

  const { error: insertErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .insert({
      phone_number: phone,
      token_hash: newTokenHash(),
      expires_at: expiresAt,
      attempt_count: 0,
      is_used: false,
    });

  if (insertErr) {
    throw new Error(`[otpLimiter] createOtpChallenge insert failed: ${insertErr.message}`);
  }
}

/**
 * Record a verify attempt for `phone` and return whether it is allowed.
 *
 * Call this BEFORE forwarding to `supabase.auth.verifyOtp()` so a wrong/expired
 * code still consumes an attempt.
 *
 * Algorithm (lifecycle-anchored):
 *   1. SELECT the most-recent ACTIVE row (`expires_at > now AND is_used=false`).
 *   2. No active row → reject (no live challenge to verify against).
 *   3. attempt_count >= MAX → reject (≤5 reached on this OTP).
 *   4. else → increment attempt_count on THAT row and allow.
 *
 * The same row serves the entire 60s OTP lifetime, so crossing a wall-clock 60s
 * boundary cannot reset the counter (open-issue #12 fix). The DB
 * `chk_otp_attempts CHECK(attempt_count <= 5)` is the hard backstop.
 */
export async function recordOtpAttempt(
  phone: string,
): Promise<OtpLimiterResult> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  // 1. Most-recent active row for this phone (highest expires_at).
  const { data: row, error: readErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .select("id, attempt_count")
    .eq("phone_number", phone)
    .eq("is_used", false)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readErr) {
    throw new Error(`[otpLimiter] read failed: ${readErr.message}`);
  }

  // 2. No active challenge — nothing to verify against. Reject (request a new code).
  if (!row) {
    return { allowed: false, attemptsUsed: 0 };
  }

  // 3. Cap reached on this OTP.
  if (row.attempt_count >= MAX_OTP_ATTEMPTS) {
    return { allowed: false, attemptsUsed: row.attempt_count };
  }

  // 4. Increment THIS row's counter.
  const nextCount = row.attempt_count + 1;
  const { error: updateErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .update({ attempt_count: nextCount })
    .eq("id", row.id);

  if (updateErr) {
    // DB CHECK violation (23514) means attempt_count > 5 — block.
    if (updateErr.code === "23514") {
      return { allowed: false, attemptsUsed: MAX_OTP_ATTEMPTS + 1 };
    }
    throw new Error(`[otpLimiter] increment failed: ${updateErr.message}`);
  }

  return {
    allowed: nextCount <= MAX_OTP_ATTEMPTS,
    attemptsUsed: nextCount,
  };
}

/**
 * Mark the active OTP challenge row(s) for `phone` as used after a successful
 * `verifyOtp`. Closes the challenge so the same OTP cannot be re-counted.
 *
 * Best-effort audit trail. Silently swallows errors — a non-critical failure
 * here must never block session creation.
 */
export async function markOtpUsed(phone: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    await supabase
      .schema("betk")
      .from("otp_tokens")
      .update({ is_used: true })
      .eq("phone_number", phone)
      .eq("is_used", false)
      .gt("expires_at", nowIso);
  } catch {
    // Best-effort — do not throw.
  }
}
