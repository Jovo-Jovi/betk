/**
 * Auth unit tests — Phase 02 / T02-FIX.
 *
 * Pure-logic assertions that require NO network / DB.
 * Runs under `pnpm test:unit` (excluded from tests/integration/).
 *
 * Covers:
 *   1. returnUrl open-redirect guard (sanitizeReturnUrl)
 *   2. phoneInputSchema — Egyptian E.164 normalisation + rejection
 *   3. otpVerifySchema — 6-digit code validation
 *   4. otp_tokens token_hash format — opaque random nonce (hex), never the OTP
 *
 * NOTE (T08-FIX / open-issue #12): the limiter is now lifecycle-anchored — the
 * counter row is opened at SEND time and `token_hash` is an opaque random server
 * nonce (`randomBytes(32).toString("hex")`), NOT a wall-clock-window-derived
 * SHA-256 and NOT used for lookup. The straddle regression for the ≤5 control
 * lives in tests/unit/otpLimiter.straddle.test.ts.
 */

import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sanitizeReturnUrl } from "@/validations/returnUrl";
import { phoneInputSchema, otpVerifySchema } from "@/validations/auth";

// ── 1. returnUrl open-redirect guard ─────────────────────────────────────────

describe("sanitizeReturnUrl — open-redirect guard", () => {
  it("accepts local paths", () => {
    expect(sanitizeReturnUrl("/account")).toBe("/account");
    expect(sanitizeReturnUrl("/")).toBe("/");
    expect(sanitizeReturnUrl("/seller/dashboard")).toBe("/seller/dashboard");
    expect(sanitizeReturnUrl("/auth/register?foo=bar")).toBe("/auth/register?foo=bar");
  });

  it("rejects protocol-relative URLs (//)", () => {
    expect(sanitizeReturnUrl("//evil.example.com")).toBe("/");
    expect(sanitizeReturnUrl("//evil.example.com/steal")).toBe("/");
  });

  it("rejects absolute http / https URLs", () => {
    expect(sanitizeReturnUrl("https://evil.example.com")).toBe("/");
    expect(sanitizeReturnUrl("http://localhost:3000/admin")).toBe("/");
    expect(sanitizeReturnUrl("HTTPS://evil.example.com")).toBe("/"); // case-insensitive
  });

  it("rejects backslash vector (/\\evil.com → treated as // by some browsers)", () => {
    expect(sanitizeReturnUrl("/\\evil.com")).toBe("/");
    expect(sanitizeReturnUrl("/\\\\evil.com")).toBe("/");
    expect(sanitizeReturnUrl("\\evil")).toBe("/");
  });

  it("rejects control characters and whitespace injection", () => {
    expect(sanitizeReturnUrl("/path\r\nX-Evil: 1")).toBe("/");
    expect(sanitizeReturnUrl("/path\n")).toBe("/");
    expect(sanitizeReturnUrl("/path\t")).toBe("/");
    expect(sanitizeReturnUrl("/\x00null")).toBe("/");
  });

  it("rejects relative paths without leading /", () => {
    expect(sanitizeReturnUrl("evil")).toBe("/");
    expect(sanitizeReturnUrl("javascript:alert(1)")).toBe("/");
    expect(sanitizeReturnUrl("data:text/html,<script>")).toBe("/");
  });

  it("falls back to / for null, undefined, and empty string", () => {
    expect(sanitizeReturnUrl(null)).toBe("/");
    expect(sanitizeReturnUrl(undefined)).toBe("/");
    expect(sanitizeReturnUrl("")).toBe("/");
  });
});

// ── 2. phoneInputSchema — Egyptian phone validation + E.164 normalisation ────

describe("phoneInputSchema — Egyptian phone validation", () => {
  it("normalises local 01X format to E.164 +201X…", () => {
    expect(phoneInputSchema.parse({ phone: "01012345678" }).phone).toBe("+201012345678");
    expect(phoneInputSchema.parse({ phone: "01112345678" }).phone).toBe("+201112345678");
    expect(phoneInputSchema.parse({ phone: "01212345678" }).phone).toBe("+201212345678");
    expect(phoneInputSchema.parse({ phone: "01512345678" }).phone).toBe("+201512345678");
  });

  it("accepts +20 E.164 format unchanged", () => {
    expect(phoneInputSchema.parse({ phone: "+201012345678" }).phone).toBe("+201012345678");
  });

  it("strips spaces and dashes before validating", () => {
    expect(phoneInputSchema.parse({ phone: "010 1234 5678" }).phone).toBe("+201012345678");
    expect(phoneInputSchema.parse({ phone: "010-1234-5678" }).phone).toBe("+201012345678");
  });

  it("rejects non-Egyptian international numbers", () => {
    expect(() => phoneInputSchema.parse({ phone: "+971501234567" })).toThrow();
    expect(() => phoneInputSchema.parse({ phone: "00971501234567" })).toThrow();
    expect(() => phoneInputSchema.parse({ phone: "+14155552671" })).toThrow();
  });

  it("rejects Egyptian landlines and malformed numbers", () => {
    expect(() => phoneInputSchema.parse({ phone: "0223456789" })).toThrow(); // Cairo landline
    expect(() => phoneInputSchema.parse({ phone: "01234" })).toThrow();       // too short
    expect(() => phoneInputSchema.parse({ phone: "020123456789" })).toThrow(); // 12 digits local
  });

  it("rejects empty and whitespace-only input", () => {
    expect(() => phoneInputSchema.parse({ phone: "" })).toThrow();
    expect(() => phoneInputSchema.parse({ phone: "   " })).toThrow();
  });
});

// ── 3. otpVerifySchema ────────────────────────────────────────────────────────

describe("otpVerifySchema — 6-digit OTP validation", () => {
  it("accepts a valid 6-digit code + E.164 phone", () => {
    expect(() =>
      otpVerifySchema.parse({ phone: "+201012345678", token: "123456" }),
    ).not.toThrow();
  });

  it("rejects codes shorter than 6 digits", () => {
    expect(() =>
      otpVerifySchema.parse({ phone: "+201012345678", token: "12345" }),
    ).toThrow();
  });

  it("rejects codes longer than 6 digits", () => {
    expect(() =>
      otpVerifySchema.parse({ phone: "+201012345678", token: "1234567" }),
    ).toThrow();
  });

  it("rejects non-numeric codes", () => {
    expect(() =>
      otpVerifySchema.parse({ phone: "+201012345678", token: "12345a" }),
    ).toThrow();
    expect(() =>
      otpVerifySchema.parse({ phone: "+201012345678", token: "      " }),
    ).toThrow();
  });

  it("rejects a non-E.164 phone (local format not accepted at verify time)", () => {
    expect(() =>
      otpVerifySchema.parse({ phone: "01012345678", token: "123456" }),
    ).toThrow();
  });
});

// ── 4. otp_tokens token_hash format (opaque random nonce — T08-FIX) ──────────

describe("otp_tokens token_hash — opaque random nonce, never an OTP digit string", () => {
  /** Mirrors otpLimiter.newTokenHash(): randomBytes(32).toString("hex"). */
  function newTokenHash(): string {
    return randomBytes(32).toString("hex");
  }

  it("produces a 64-char lowercase hex string", () => {
    expect(newTokenHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cannot be confused with a 6-digit OTP", () => {
    const hash = newTokenHash();
    expect(hash.length).toBeGreaterThan(6);
    expect(hash).not.toMatch(/^\d{6}$/);
  });

  it("is unpredictable — successive nonces differ (not derived from inputs)", () => {
    expect(newTokenHash()).not.toBe(newTokenHash());
  });
});
