/**
 * OTP limiter — window-straddle regression (Phase 02 / T08-FIX, open-issue #12).
 *
 * Reproduces the AC-AUTH-2 clause-4 defeat found at T08: when the attempt
 * counter is keyed to an ABSOLUTE wall-clock 60s epoch bucket, a single 60s OTP
 * issued mid-bucket straddles the next epoch boundary, so attempts after the
 * boundary land in a FRESH counter — granting ~10 attempts on one valid code.
 *
 * The test fakes the system clock so one OTP (issued 30s before an epoch
 * boundary, valid for its full 60s) is verified on BOTH sides of the boundary.
 * It MUST FAIL against the old wall-clock bucketing (the 6th attempt is wrongly
 * allowed) and PASS against the lifecycle-anchored fix (the 6th is rejected).
 *
 * Pure unit test: the service-role client is mocked with an in-memory
 * `otp_tokens` store; no network / staging. Runs under `pnpm test:unit`.
 *
 * NOTE: no raw OTP is ever involved here — the limiter only ever sees the phone
 * + attempt counts. Nothing in this file logs or asserts an OTP value.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// ── In-memory mock of the service-role Supabase client (otp_tokens only) ─────
const hoisted = vi.hoisted(() => {
  type Row = Record<string, unknown> & { table: string };
  const store: { rows: Row[] } = { rows: [] };
  let idSeq = 1;

  type Filter = { type: "eq" | "gt"; col: string; val: unknown };

  function matches(row: Row, filters: Filter[]): boolean {
    return filters.every((f) => {
      if (f.type === "eq") return row[f.col] === f.val;
      if (f.type === "gt") {
        if (f.col === "expires_at") {
          return Date.parse(row[f.col] as string) > Date.parse(f.val as string);
        }
        return (row[f.col] as number) > (f.val as number);
      }
      return true;
    });
  }

  class QB {
    table: string;
    op: "select" | "insert" | "update" | null = null;
    insertPayload: unknown = null;
    updatePayload: Record<string, unknown> | null = null;
    filters: Filter[] = [];
    orderCol: string | null = null;
    orderAsc = true;
    limitN: number | null = null;

    constructor(table: string) {
      this.table = table;
    }
    select() {
      this.op = "select";
      return this;
    }
    insert(payload: unknown) {
      this.op = "insert";
      this.insertPayload = payload;
      return this;
    }
    update(payload: Record<string, unknown>) {
      this.op = "update";
      this.updatePayload = payload;
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push({ type: "eq", col, val });
      return this;
    }
    gt(col: string, val: unknown) {
      this.filters.push({ type: "gt", col, val });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = opts?.ascending ?? true;
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }
    private runSelect(): Row[] {
      let rows = store.rows.filter(
        (r) => r.table === this.table && matches(r, this.filters),
      );
      if (this.orderCol) {
        const col = this.orderCol;
        rows = rows.slice().sort((a, b) => {
          const av = col === "expires_at" ? Date.parse(a[col] as string) : (a[col] as number);
          const bv = col === "expires_at" ? Date.parse(b[col] as string) : (b[col] as number);
          return this.orderAsc ? av - bv : bv - av;
        });
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      return rows;
    }
    maybeSingle() {
      const rows = this.runSelect();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }
    private exec() {
      if (this.op === "insert") {
        const payload = this.insertPayload;
        const arr = Array.isArray(payload) ? payload : [payload];
        for (const p of arr) {
          store.rows.push({ table: this.table, id: `row-${idSeq++}`, ...(p as object) } as Row);
        }
        return { error: null };
      }
      if (this.op === "update") {
        const targets = store.rows.filter(
          (r) => r.table === this.table && matches(r, this.filters),
        );
        for (const r of targets) Object.assign(r, this.updatePayload);
        return { error: null };
      }
      return { error: null };
    }
    // Thenable: `await builder` executes a pending insert/update.
    then(resolve: (v: { error: null }) => void, reject?: (e: unknown) => void) {
      try {
        resolve(this.exec());
      } catch (e) {
        reject?.(e);
      }
    }
  }

  function makeClient() {
    return { schema: () => ({ from: (t: string) => new QB(t) }) };
  }

  return { store, makeClient };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => hoisted.makeClient(),
}));

// Import AFTER the mock is registered.
import {
  createOtpChallenge,
  recordOtpAttempt,
  markOtpUsed,
  MAX_OTP_ATTEMPTS,
} from "@/services/otpLimiter";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const PHONE = "+201000000000"; // synthetic; never dialled
// An epoch-aligned 60s boundary (divisible by 60_000) and an issuance 30s before it.
const BOUNDARY_MS = 1_700_000_040_000; // 1_700_000_040_000 / 60_000 = 28_333_334 (integer)
const ISSUED_AT_MS = BOUNDARY_MS - 30_000; // mid-bucket; OTP valid ISSUED_AT_MS .. +60s

describe("OTP limiter — single OTP must not exceed ≤5 across a wall-clock boundary (open-issue #12)", () => {
  beforeEach(() => {
    hoisted.store.rows = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects the 6th attempt on ONE still-valid OTP whose life straddles a 60s epoch boundary", async () => {
    vi.setSystemTime(new Date(ISSUED_AT_MS));

    // Simulate the SEND-time challenge row (lifecycle anchor): one row for this
    // OTP, valid for its full 60s. The lifecycle-anchored limiter selects this
    // row by (phone, is_used=false, expires_at>now); the old wall-clock limiter
    // ignores it (it keys on a per-bucket token_hash) and so creates fresh rows.
    hoisted.store.rows.push({
      table: "otp_tokens",
      id: "seed-otp",
      phone_number: PHONE,
      token_hash: "a".repeat(64), // opaque nonce — NEVER the OTP
      expires_at: new Date(ISSUED_AT_MS + 60_000).toISOString(),
      attempt_count: 0,
      is_used: false,
    });

    // Attempts 1–5 BEFORE the boundary (bucket A under the old scheme).
    const beforeOffsets = [0, 5_000, 10_000, 15_000, 25_000]; // all < 30_000
    const allowed: boolean[] = [];
    for (const off of beforeOffsets) {
      vi.setSystemTime(new Date(ISSUED_AT_MS + off));
      const r = await recordOtpAttempt(PHONE);
      allowed.push(r.allowed);
    }
    expect(allowed).toEqual([true, true, true, true, true]);

    // 6th attempt AFTER the boundary, but the SAME OTP is still valid
    // (boundary+1s = issued+31s < issued+60s). Old scheme = new bucket = allowed.
    vi.setSystemTime(new Date(BOUNDARY_MS + 1_000));
    expect(BOUNDARY_MS + 1_000).toBeLessThan(ISSUED_AT_MS + 60_000); // OTP still valid
    const sixth = await recordOtpAttempt(PHONE);

    // The control: the 6th attempt across the boundary MUST be rejected.
    expect(sixth.allowed).toBe(false);
  });

  it("MAX_OTP_ATTEMPTS is 5", () => {
    expect(MAX_OTP_ATTEMPTS).toBe(5);
  });
});

// ── Lifecycle contract (shared by verifyOtp + verifyPhoneOtp) ────────────────
// Both verify Server Actions drive the SAME primitives (createOtpChallenge at
// send, recordOtpAttempt at verify, markOtpUsed on success), so covering them
// here covers both paths.
describe("OTP limiter — lifecycle (send → ≤5 verify → used)", () => {
  beforeEach(() => {
    hoisted.store.rows = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(ISSUED_AT_MS));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens exactly one challenge row at send (attempt_count 0, opaque hex nonce, not used)", async () => {
    await createOtpChallenge(PHONE);
    const rows = hoisted.store.rows.filter(
      (r) => r.table === "otp_tokens" && r.phone_number === PHONE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attempt_count).toBe(0);
    expect(rows[0]!.is_used).toBe(false);
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.token_hash).not.toMatch(/^\d{6}$/); // never an OTP
  });

  it("allows 5 attempts then rejects the 6th on one challenge", async () => {
    await createOtpChallenge(PHONE);
    for (let i = 1; i <= MAX_OTP_ATTEMPTS; i++) {
      const r = await recordOtpAttempt(PHONE);
      expect(r.allowed).toBe(true);
      expect(r.attemptsUsed).toBe(i);
    }
    const sixth = await recordOtpAttempt(PHONE);
    expect(sixth.allowed).toBe(false);
  });

  it("rejects verify when no challenge was opened (no active row)", async () => {
    const r = await recordOtpAttempt(PHONE);
    expect(r.allowed).toBe(false);
    expect(r.attemptsUsed).toBe(0);
  });

  it("a resend supersedes the prior challenge — only the freshest is counted", async () => {
    await createOtpChallenge(PHONE);
    await recordOtpAttempt(PHONE); // burn 1 on the first challenge
    await createOtpChallenge(PHONE); // resend → supersede

    const active = hoisted.store.rows.filter(
      (r) => r.table === "otp_tokens" && r.phone_number === PHONE && r.is_used === false,
    );
    expect(active).toHaveLength(1); // prior row was marked used

    const fresh = await recordOtpAttempt(PHONE);
    expect(fresh.allowed).toBe(true);
    expect(fresh.attemptsUsed).toBe(1); // fresh counter on the new challenge
  });

  it("markOtpUsed closes the challenge so a later verify is rejected", async () => {
    await createOtpChallenge(PHONE);
    await recordOtpAttempt(PHONE);
    await markOtpUsed(PHONE);

    const after = await recordOtpAttempt(PHONE);
    expect(after.allowed).toBe(false);
  });

  it("an expired challenge is not counted (rejects after the 60s OTP lifetime)", async () => {
    await createOtpChallenge(PHONE);
    // Advance past the OTP's 60s life — the active-row select (expires_at > now) misses it.
    vi.setSystemTime(new Date(ISSUED_AT_MS + 61_000));
    const r = await recordOtpAttempt(PHONE);
    expect(r.allowed).toBe(false);
  });
});
