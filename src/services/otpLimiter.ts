/**
 * OTP attempt limiter — AC-AUTH-2 clause 4 ("≤5 attempts per token").
 *
 * GoTrue does NOT track per-token failed attempts — it only has per-IP
 * throttling (ADR-010 §4). This service provides the app-layer ≤5-attempt
 * counter backed by `betk.otp_tokens`.
 *
 * Security contract (NEVER violate):
 *   • NEVER store the raw OTP anywhere in this file or its callers.
 *   • token_hash = SHA-256 of a server-generated nonce keyed to phone +
 *     the 60-second challenge window; it is NOT derivable from the OTP.
 *   • The DB CHECK(attempt_count <= 5) is the hard backstop.
 *   • attempt_count increments BEFORE calling GoTrue so a timeout cannot
 *     grant a free extra attempt.
 *
 * Table: betk.otp_tokens (service-only — no client-readable RLS policy).
 * Cleanup: hourly pg_cron `cleanup-otp-tokens` purges expired rows.
 *
 * SERVER ONLY — uses the service-role client.
 */

import "server-only";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/** Maximum allowed verify attempts per OTP challenge (AC-AUTH-2). */
export const MAX_OTP_ATTEMPTS = 5;

/** OTP TTL in seconds (R-A02 / GoTrue SMS_OTP_EXP = 60). */
const OTP_TTL_SECONDS = 60;

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Derive an opaque SHA-256 nonce from `phone + challengeWindowMs`.
 *
 * GoTrue issues at most one OTP per 60 s (SMS_MAX_FREQUENCY). We round `now`
 * to the 60-second boundary so all verify attempts within the same GoTrue
 * challenge share one `otp_tokens` row.
 *
 * The hash is NOT derivable from the OTP — it encodes only the phone and the
 * time-window, both of which are non-secret.
 */
function deriveTokenHash(phone: string, windowStartMs: number): string {
  return createHash("sha256")
    .update(`betk-otp-challenge:${phone}:${windowStartMs}`)
    .digest("hex");
}

/** Round `nowMs` down to the nearest 60-second boundary. */
function challengeWindowStart(nowMs: number): number {
  const windowMs = OTP_TTL_SECONDS * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface OtpLimiterResult {
  /** Whether the attempt is allowed (attempt_count was below MAX before this call). */
  allowed: boolean;
  /** attempt_count AFTER this call (1 = first attempt; MAX+1 = blocked). */
  attemptsUsed: number;
}

/**
 * Record a verify attempt for `phone` and return whether it is allowed.
 *
 * Call this BEFORE forwarding to `supabase.auth.verifyOtp()`.
 *
 * Algorithm:
 *   1. SELECT the current row for (phone, challenge-window).
 *   2a. Row missing → INSERT with attempt_count = 1 (first attempt; allowed).
 *   2b. attempt_count already MAX → reject immediately (no DB write needed).
 *   2c. attempt_count < MAX → UPDATE to attempt_count + 1 (allowed if ≤ MAX).
 *
 * The DB `chk_otp_attempts CHECK(attempt_count <= 5)` is the hard backstop
 * that catches any race or off-by-one in the logic above.
 */
export async function recordOtpAttempt(
  phone: string,
): Promise<OtpLimiterResult> {
  const supabase = createServiceClient();
  const nowMs = Date.now();
  const windowStartMs = challengeWindowStart(nowMs);
  const tokenHash = deriveTokenHash(phone, windowStartMs);
  const expiresAt = new Date(windowStartMs + OTP_TTL_SECONDS * 1000).toISOString();

  // 1. Read the existing row for this challenge window (if any).
  const { data: existing, error: readErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .select("id, attempt_count")
    .eq("token_hash", tokenHash)
    .eq("phone_number", phone)
    .maybeSingle();

  if (readErr) {
    throw new Error(`[otpLimiter] read failed: ${readErr.message}`);
  }

  if (!existing) {
    // 2a. First attempt — insert with attempt_count = 1.
    const { error: insertErr } = await supabase
      .schema("betk")
      .from("otp_tokens")
      .insert({
        phone_number: phone,
        token_hash: tokenHash,
        expires_at: expiresAt,
        attempt_count: 1,
        is_used: false,
      });

    if (insertErr) {
      // Concurrent insert race — read again and fall through to increment path.
      if (insertErr.code !== "23505") {
        throw new Error(`[otpLimiter] insert failed: ${insertErr.message}`);
      }
      // Retry read after race.
      const { data: raceRow, error: raceErr } = await supabase
        .schema("betk")
        .from("otp_tokens")
        .select("id, attempt_count")
        .eq("token_hash", tokenHash)
        .eq("phone_number", phone)
        .maybeSingle();
      if (raceErr || !raceRow) {
        throw new Error("[otpLimiter] race recovery read failed");
      }
      return incrementExistingRow(supabase, raceRow.id, raceRow.attempt_count);
    }

    return { allowed: true, attemptsUsed: 1 };
  }

  // 2b / 2c. Row exists — check and increment.
  return incrementExistingRow(supabase, existing.id, existing.attempt_count);
}

/** Increment an existing row; enforce the MAX cap. */
async function incrementExistingRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rowId: string,
  currentCount: number,
): Promise<OtpLimiterResult> {
  if (currentCount >= MAX_OTP_ATTEMPTS) {
    return { allowed: false, attemptsUsed: currentCount };
  }

  const nextCount = currentCount + 1;

  const { error: updateErr } = await supabase
    .schema("betk")
    .from("otp_tokens")
    .update({ attempt_count: nextCount })
    .eq("id", rowId);

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
 * Mark the otp_tokens row as used after a successful `verifyOtp`.
 *
 * Best-effort audit trail. Silently swallows errors — a non-critical failure
 * here must never block session creation.
 */
export async function markOtpUsed(phone: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const windowStartMs = challengeWindowStart(Date.now());
    const tokenHash = deriveTokenHash(phone, windowStartMs);

    await supabase
      .schema("betk")
      .from("otp_tokens")
      .update({ is_used: true })
      .eq("token_hash", tokenHash)
      .eq("phone_number", phone);
  } catch {
    // Best-effort — do not throw.
  }
}
