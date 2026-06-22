/**
 * RLS verification harness — Phase 01 / T08 (BETK_ERD.md §3, C3 §5).
 *
 * Asserts default-deny + the core Row Level Security policies of the BETK schema
 * against the **STAGING** Supabase project. NEVER runs against production: a hard
 * project-ref guard (see STAGING_GUARD below) throws before any fixture is seeded
 * unless the target ref is allow-listed.
 *
 * Design
 * ------
 * - Keys are read via `@/configs/env` (clientEnv: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)
 *   and the service-role client via `@/lib/supabase/service` (which reads
 *   serverEnv.SUPABASE_SERVICE_KEY) — not raw process.env.
 * - The app is OTP-only, but tests mint identities through the GoTrue admin API:
 *   `auth.admin.createUser({ email, email_confirm, password })` creates the
 *   auth.users row; we then insert the matching `betk.users` row (same id) with
 *   the actor's phone_number / auth_provider / role / status. Each actor's RLS
 *   context is a fresh anon client that `signInWithPassword(...)`; its session
 *   drives `auth.uid()`. One pure anon client (no session) is also kept.
 * - The service-role client seeds fixtures (bypassing RLS) and tears EVERYTHING
 *   down in afterAll (betk rows + every auth.users row created here).
 *
 * Seed is deterministic (fixed topology/states) and idempotent (unique string
 * columns carry a per-run suffix; a prefix sweep removes any crashed-run
 * leftovers before seeding).
 *
 * Output: every assertion logs PASS / FAIL / FINDING with the table + policy
 * under test, plus a summary. If assertion 1 (default-deny / public read) fails,
 * the phase is BLOCKED (the suite fails) and a finding is emitted.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Runtime gating: skip cleanly when staging credentials are absent.
// ---------------------------------------------------------------------------
const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

// Known STAGING project ref. Override via RLS_ALLOW_PROJECT_REF (comma list).
// production refs are intentionally NOT listed here.
const STAGING_ALLOWLIST = (
  process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Opt-in for the append-only assertion. OFF by default because verifying it
// requires INSERTing rows into order_status_history / moderation_logs, whose
// `DO INSTEAD NOTHING` UPDATE/DELETE rules make those rows undeletable via the
// Data API — which would violate the clean-teardown contract.
const RUN_APPEND_ONLY = process.env.RLS_TEST_APPEND_ONLY === "1";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------
type BetkClient = SupabaseClient<Database, "betk">;

type ActorKey = "buyerA" | "buyerB" | "googleG" | "admin" | "seller";

interface Actor {
  key: ActorKey;
  email: string;
  password: string;
  role: Database["betk"]["Enums"]["user_role"];
  authProvider: Database["betk"]["Enums"]["auth_provider"];
  phone: string | null;
  status: Database["betk"]["Enums"]["user_status"];
  id: string; // auth.users id (== betk.users id)
  client: BetkClient; // RLS context (signed in)
}

type Outcome = "PASS" | "FAIL" | "FINDING";
interface ResultRow {
  assertion: string;
  table: string;
  policy: string;
  outcome: Outcome;
  detail: string;
}

const results: ResultRow[] = [];
const findings: string[] = [];

function record(
  assertion: string,
  table: string,
  policy: string,
  outcome: Outcome,
  detail: string,
): void {
  results.push({ assertion, table, policy, outcome, detail });
  // eslint-disable-next-line no-console
  console.log(`[${outcome}] ${assertion} ${table}/${policy} — ${detail}`);
  if (outcome === "FINDING") findings.push(`${assertion} (${table}): ${detail}`);
}

// supabase-js infers `never` for some insert/update/delete `.select()` result
// types; coerce through `unknown` so the harness checks stay type-safe.
const rowCount = (data: unknown): number => (Array.isArray(data) ? data.length : 0);
const firstId = (data: unknown): string | undefined => {
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const id = (data[0] as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return undefined;
};

const EMAIL_PREFIX = "rls-smoke-";
const RUN = randomUUID().slice(0, 8); // unique-string suffix per run
const PASSWORD = `Rls-Smoke-${RUN}!`;

function anonClient(): BetkClient {
  return createClient<Database, "betk">(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: "betk" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// Service-role client (bypasses RLS) for seeding + teardown.
const service = createServiceClient();
const svc = () => service.schema("betk");

/**
 * Deletes every fixture owned by the given auth user ids, in FK-safe order,
 * then removes the auth.users rows. Self-derives store/order ids so it works
 * both for this run's teardown and for sweeping crashed-run leftovers.
 * Note: append-only rows (order_status_history / moderation_logs) cannot be
 * deleted through the Data API; the harness avoids seeding them by default.
 */
async function purgeByUserIds(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const db = svc();

  const { data: stores } = await db
    .from("stores")
    .select("id")
    .in("seller_id", userIds);
  const storeIds = (stores ?? []).map((s) => s.id);

  const orderIdSet = new Set<string>();
  const { data: ordersByBuyer } = await db
    .from("orders")
    .select("id")
    .in("buyer_id", userIds);
  for (const o of ordersByBuyer ?? []) orderIdSet.add(o.id);
  if (storeIds.length) {
    const { data: ordersByStore } = await db
      .from("orders")
      .select("id")
      .in("store_id", storeIds);
    for (const o of ordersByStore ?? []) orderIdSet.add(o.id);
  }
  const orderIds = [...orderIdSet];

  if (orderIds.length) {
    await db.from("order_items").delete().in("order_id", orderIds);
    await db.from("payments").delete().in("order_id", orderIds);
    await db.from("orders").delete().in("id", orderIds);
  }
  if (storeIds.length) {
    await db.from("payouts").delete().in("store_id", storeIds);
    await db.from("listings").delete().in("store_id", storeIds);
    await db.from("stores").delete().in("id", storeIds);
  }
  await db.from("seller_profiles").delete().in("id", userIds);
  await db.from("buyer_profiles").delete().in("id", userIds);
  await db.from("addresses").delete().in("buyer_id", userIds);
  await db.from("users").delete().in("id", userIds);

  for (const id of userIds) {
    await service.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

/** Removes leftover auth users (and their fixtures) from prior crashed runs. */
async function sweepLeftovers(): Promise<void> {
  const leftover: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data?.users.length) break;
    for (const u of data.users) {
      if (u.email?.startsWith(EMAIL_PREFIX)) leftover.push(u.id);
    }
    if (data.users.length < 200) break;
  }
  await purgeByUserIds(leftover);
}

// ---------------------------------------------------------------------------
// Shared fixture state (populated in beforeAll)
// ---------------------------------------------------------------------------
const actors = {} as Record<ActorKey, Actor>;
const createdUserIds: string[] = [];
let anon: BetkClient;
let storeId = "";
let activeListingId = "";
let draftListingId = "";
let deletedListingId = "";
let buyerAOrderId = "";

async function createActor(spec: {
  key: ActorKey;
  role: Actor["role"];
  authProvider: Actor["authProvider"];
  phone: string | null;
  status: Actor["status"];
}): Promise<Actor> {
  const email = `${EMAIL_PREFIX}${spec.key}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed for ${spec.key}: ${error?.message}`);
  }
  const user: User = data.user;
  createdUserIds.push(user.id);

  const { error: insErr } = await svc()
    .from("users")
    .insert({
      id: user.id,
      phone_number: spec.phone,
      auth_provider: spec.authProvider,
      role: spec.role,
      status: spec.status,
    });
  if (insErr) {
    throw new Error(`betk.users insert failed for ${spec.key}: ${insErr.message}`);
  }

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) {
    throw new Error(`signIn failed for ${spec.key}: ${signInErr.message}`);
  }

  const actor: Actor = {
    key: spec.key,
    email,
    password: PASSWORD,
    role: spec.role,
    authProvider: spec.authProvider,
    phone: spec.phone,
    status: spec.status,
    id: user.id,
    client,
  };
  actors[spec.key] = actor;
  return actor;
}

describe.skipIf(!HAS_CREDS)("RLS smoke harness (staging)", () => {
  beforeAll(async () => {
    // ---- STAGING_GUARD: refuse to touch a non-allow-listed project ----
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `RLS harness refused: project ref "${ref}" is not in the staging ` +
          `allow-list [${STAGING_ALLOWLIST.join(", ")}]. ` +
          `Set RLS_ALLOW_PROJECT_REF to override (NEVER point this at production).`,
      );
    }

    await sweepLeftovers();

    // ---- Actors ----
    await createActor({
      key: "buyerA",
      role: "buyer",
      authProvider: "phone",
      phone: `0100${RUN}A`,
      status: "active",
    });
    await createActor({
      key: "buyerB",
      role: "buyer",
      authProvider: "phone",
      phone: `0100${RUN}B`,
      status: "active",
    });
    await createActor({
      key: "googleG",
      role: "buyer",
      authProvider: "google",
      phone: null, // OD-4: OAuth user without a verified phone
      status: "active",
    });
    await createActor({
      key: "admin",
      role: "admin",
      authProvider: "phone",
      phone: `0100${RUN}D`,
      status: "active",
    });
    await createActor({
      key: "seller",
      role: "seller",
      authProvider: "phone",
      phone: `0100${RUN}S`,
      status: "active",
    });

    anon = anonClient();

    // ---- Seller profile + active store (owned by `seller`) ----
    const { error: spErr } = await svc()
      .from("seller_profiles")
      .insert({ id: actors.seller.id, status: "active" });
    if (spErr) throw new Error(`seller_profiles insert: ${spErr.message}`);

    const { data: storeRow, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: actors.seller.id,
        name_ar: "متجر اختبار RLS",
        slug: `rls-smoke-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
        status: "active",
      })
      .select("id")
      .single();
    if (storeErr || !storeRow) throw new Error(`stores insert: ${storeErr?.message}`);
    storeId = storeRow.id;

    // A real category id (FK target) — reuse the existing seeded taxonomy.
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`categories lookup: ${catErr?.message}`);
    const categoryId = cat.id;

    // ---- Listings in active / draft / soft-deleted states ----
    const baseListing = {
      store_id: storeId,
      category_id: categoryId,
      type: "product" as const,
      price: 100,
      price_type: "fixed" as const,
      stock_qty: 5,
    };
    const { data: active, error: aErr } = await svc()
      .from("listings")
      .insert({ ...baseListing, title_ar: `RLS active ${RUN}`, status: "active" })
      .select("id")
      .single();
    if (aErr || !active) throw new Error(`active listing: ${aErr?.message}`);
    activeListingId = active.id;

    const { data: draft, error: dErr } = await svc()
      .from("listings")
      .insert({ ...baseListing, title_ar: `RLS draft ${RUN}`, status: "draft" })
      .select("id")
      .single();
    if (dErr || !draft) throw new Error(`draft listing: ${dErr?.message}`);
    draftListingId = draft.id;

    const { data: deleted, error: delErr } = await svc()
      .from("listings")
      .insert({
        ...baseListing,
        title_ar: `RLS deleted ${RUN}`,
        status: "active",
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (delErr || !deleted) throw new Error(`deleted listing: ${delErr?.message}`);
    deletedListingId = deleted.id;

    // ---- One order owned by Buyer A ----
    const { data: order, error: oErr } = await svc()
      .from("orders")
      .insert({
        betk_ref: `RLS-${RUN}-A`,
        buyer_id: actors.buyerA.id,
        store_id: storeId,
        delivery_method: "delivery",
        subtotal: 100,
        delivery_fee: 0,
        total_amount: 100,
        status: "pending",
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(`order insert: ${oErr?.message}`);
    buyerAOrderId = order.id;
  });

  afterAll(async () => {
    await purgeByUserIds(createdUserIds);

    // ---- Summary ----
    const pass = results.filter((r) => r.outcome === "PASS").length;
    const fail = results.filter((r) => r.outcome === "FAIL").length;
    const find = results.filter((r) => r.outcome === "FINDING").length;
    // eslint-disable-next-line no-console
    console.log(
      `\n===== RLS SMOKE SUMMARY =====\n` +
        `PASS: ${pass}  FAIL: ${fail}  FINDING: ${find}\n` +
        results
          .map((r) => `  [${r.outcome}] ${r.assertion} (${r.table}/${r.policy})`)
          .join("\n") +
        (findings.length
          ? `\n\n----- FINDINGS -----\n` +
            findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")
          : "") +
        `\n=============================\n`,
    );
  });

  // -------------------------------------------------------------------------
  // Assertion 1 — default-deny / public read (BLOCKING if it fails)
  // -------------------------------------------------------------------------
  it("A1: anon can read the active listing but NOT draft/soft-deleted", async () => {
    const { data: activeRows, error: activeErr } = await anon
      .from("listings")
      .select("id")
      .eq("id", activeListingId);
    const { data: draftRows } = await anon
      .from("listings")
      .select("id")
      .eq("id", draftListingId);
    const { data: deletedRows } = await anon
      .from("listings")
      .select("id")
      .eq("id", deletedListingId);

    const canReadActive = !activeErr && (activeRows?.length ?? 0) === 1;
    const hidesDraft = (draftRows?.length ?? 0) === 0;
    const hidesDeleted = (deletedRows?.length ?? 0) === 0;

    if (canReadActive && hidesDraft && hidesDeleted) {
      record(
        "A1",
        "listings",
        "listings_public",
        "PASS",
        "anon reads active; draft + soft-deleted hidden (default-deny holds)",
      );
    } else {
      record(
        "A1",
        "listings",
        "listings_public",
        "FAIL",
        `BLOCKING default-deny breach — active:${canReadActive} ` +
          `draftHidden:${hidesDraft} deletedHidden:${hidesDeleted}`,
      );
    }

    // Hard gate: a default-deny breach blocks the phase.
    expect(canReadActive, "anon must read the active listing").toBe(true);
    expect(hidesDraft, "anon must NOT read the draft listing").toBe(true);
    expect(hidesDeleted, "anon must NOT read the soft-deleted listing").toBe(true);
  });

  // -------------------------------------------------------------------------
  // Assertion 2 — buyer isolation
  // -------------------------------------------------------------------------
  it("A2: Buyer B cannot read Buyer A's order (no error leak)", async () => {
    const { data, error } = await actors.buyerB.client
      .from("orders")
      .select("id")
      .eq("id", buyerAOrderId);

    // Sanity: the owner CAN read it.
    const { data: ownerRows } = await actors.buyerA.client
      .from("orders")
      .select("id")
      .eq("id", buyerAOrderId);

    const isolated = error === null && (data?.length ?? 0) === 0;
    const ownerCanRead = (ownerRows?.length ?? 0) === 1;

    record(
      "A2",
      "orders",
      "orders_access",
      isolated && ownerCanRead ? "PASS" : "FAIL",
      isolated
        ? `Buyer B sees 0 rows, no error; owner sees own order:${ownerCanRead}`
        : `isolation breach — rows:${data?.length} error:${error?.message ?? "none"}`,
    );

    expect(error).toBeNull(); // denial must be empty result, not an error leak
    expect(data?.length ?? 0).toBe(0);
    expect(ownerCanRead).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Assertion 3 — helper functions is_admin() / my_store_id()
  // -------------------------------------------------------------------------
  it("A3: is_admin() and my_store_id() resolve correctly", async () => {
    const { data: adminIsAdmin } = await actors.admin.client.rpc("is_admin");
    const { data: buyerIsAdmin } = await actors.buyerA.client.rpc("is_admin");
    const { data: sellerStore } = await actors.seller.client.rpc("my_store_id");
    const { data: buyerStore } = await actors.buyerA.client.rpc("my_store_id");

    const ok =
      adminIsAdmin === true &&
      buyerIsAdmin === false &&
      sellerStore === storeId &&
      (buyerStore === null || buyerStore === undefined);

    record(
      "A3",
      "is_admin/my_store_id",
      "helpers",
      ok ? "PASS" : "FAIL",
      `is_admin(admin)=${adminIsAdmin} is_admin(buyer)=${buyerIsAdmin} ` +
        `my_store_id(seller)=${sellerStore === storeId ? "match" : sellerStore} ` +
        `my_store_id(buyer)=${buyerStore ?? "null"}`,
    );

    expect(adminIsAdmin).toBe(true);
    expect(buyerIsAdmin).toBe(false);
    expect(sellerStore).toBe(storeId);
    expect(buyerStore ?? null).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Assertion 4 — OD-4 verified-phone transaction gate (RESTRICTIVE WITH CHECK)
  // -------------------------------------------------------------------------
  it("A4: phone gate rejects no-phone Google user; phone user passes a gated insert", async () => {
    // 4a (security-critical): Google user G (phone NULL) must be REJECTED on an
    // orders INSERT even with otherwise-correct ownership.
    const { data: gOrder, error: gErr } = await actors.googleG.client
      .from("orders")
      .insert({
        betk_ref: `RLS-${RUN}-G`,
        buyer_id: actors.googleG.id,
        store_id: storeId,
        delivery_method: "delivery",
        subtotal: 100,
        delivery_fee: 0,
        total_amount: 100,
        status: "pending",
      })
      .select("id");
    const gRejected = !!gErr && rowCount(gOrder) === 0;
    record(
      "A4a",
      "orders",
      "orders_phone_gate (RESTRICTIVE)",
      gRejected ? "PASS" : "FAIL",
      gRejected
        ? `Google user (phone NULL) rejected on orders INSERT: ${gErr?.message}`
        : `SECURITY BREACH — no-phone user inserted an order`,
    );
    // If somehow inserted, clean it up so teardown stays complete.
    const gOrderId = firstId(gOrder);
    if (gOrderId) await svc().from("orders").delete().eq("id", gOrderId);
    expect(gRejected).toBe(true);

    // 4b (spec: "Buyer A passes"): Buyer A has a verified phone, so the phone
    // gate is satisfied. However, `orders` currently has NO permissive INSERT
    // policy (only `orders_access` SELECT + the RESTRICTIVE phone gate), so the
    // insert is default-denied regardless of phone. Capture this as a finding
    // rather than silently passing, and prove the positive path on `payouts`.
    const { data: aOrder, error: aErr } = await actors.buyerA.client
      .from("orders")
      .insert({
        betk_ref: `RLS-${RUN}-A2`,
        buyer_id: actors.buyerA.id,
        store_id: storeId,
        delivery_method: "delivery",
        subtotal: 100,
        delivery_fee: 0,
        total_amount: 100,
        status: "pending",
      })
      .select("id");
    const aOrderId = firstId(aOrder);
    if (aOrderId) {
      await svc().from("orders").delete().eq("id", aOrderId);
      record(
        "A4b",
        "orders",
        "orders INSERT (ownership)",
        "PASS",
        "phone-verified Buyer A inserted an order (permissive INSERT policy present)",
      );
    } else {
      record(
        "A4b",
        "orders",
        "orders INSERT (ownership)",
        "FINDING",
        `phone-verified Buyer A also rejected on orders INSERT (${aErr?.message}) — ` +
          `orders has NO permissive INSERT policy; the RESTRICTIVE phone gate cannot ` +
          `be positively verified on orders until the ownership INSERT policy lands ` +
          `(expected in a later phase). Positive path proven on payouts below.`,
      );
    }

    // 4c (positive gate proof): Seller has a verified phone AND owns the store,
    // so `payouts_insert` (permissive: store_id = my_store_id()) + the
    // `payouts_phone_gate` (RESTRICTIVE) both pass -> INSERT succeeds.
    const { data: payout, error: pErr } = await actors.seller.client
      .from("payouts")
      .insert({
        store_id: storeId,
        amount: 100,
        method: "instapay",
        account_details: `RLS_SMOKE ${RUN}`,
      })
      .select("id");
    const payoutOk = !pErr && rowCount(payout) === 1;
    record(
      "A4c",
      "payouts",
      "payouts_insert + payouts_phone_gate (RESTRICTIVE)",
      payoutOk ? "PASS" : "FAIL",
      payoutOk
        ? "phone-verified store owner passed the phone-gated payouts INSERT"
        : `unexpected payouts INSERT rejection: ${pErr?.message}`,
    );
    expect(payoutOk).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Assertion 5 — append-only sanity (OPTIONAL, opt-in)
  // -------------------------------------------------------------------------
  it("A5: non-admin UPDATE/DELETE on append-only logs is denied", async () => {
    if (!RUN_APPEND_ONLY) {
      record(
        "A5",
        "moderation_logs/order_status_history",
        "append-only (RULE + RLS)",
        "FINDING",
        "skipped by default — verifying this requires INSERTing rows into tables " +
          "whose `DO INSTEAD NOTHING` UPDATE/DELETE rules make them undeletable via " +
          "the Data API, conflicting with clean teardown. Enforcement is structurally " +
          "guaranteed by those rules + the absence of non-admin UPDATE/DELETE policies. " +
          "Set RLS_TEST_APPEND_ONLY=1 to exercise it (leaves a small, bounded residue).",
      );
      return;
    }

    // Opt-in path: seed a moderation_logs row (INSERT is allowed) and confirm a
    // non-admin cannot mutate it. NOTE: the row cannot be deleted afterwards.
    const { data: log, error: logErr } = await svc()
      .from("moderation_logs")
      .insert({
        admin_id: actors.admin.id,
        action: "rls_smoke_appendonly",
        target_type: "listing",
        target_id: activeListingId,
        reason: `RLS_SMOKE ${RUN}`,
      })
      .select("id")
      .single();
    if (logErr || !log) throw new Error(`moderation_logs seed: ${logErr?.message}`);

    const { data: upd } = await actors.buyerB.client
      .from("moderation_logs")
      .update({ reason: "HACKED" })
      .eq("id", log.id)
      .select("id");
    const { data: del } = await actors.buyerB.client
      .from("moderation_logs")
      .delete()
      .eq("id", log.id)
      .select("id");

    const { data: after } = await svc()
      .from("moderation_logs")
      .select("id, reason")
      .eq("id", log.id)
      .single();

    const denied =
      rowCount(upd) === 0 &&
      rowCount(del) === 0 &&
      after?.reason === `RLS_SMOKE ${RUN}`;

    record(
      "A5",
      "moderation_logs",
      "modlog_admin (no non-admin write)",
      denied ? "PASS" : "FAIL",
      denied
        ? "non-admin UPDATE+DELETE affected 0 rows; row intact"
        : `append-only/RLS breach — updated:${rowCount(upd)} deleted:${rowCount(del)}`,
    );
    findings.push(
      "A5 opt-in seeded a moderation_logs row that the Data API cannot delete " +
        "(append-only rule) — manual cleanup required if undesired.",
    );

    expect(denied).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Static findings carried forward from earlier tasks / schema review.
  // -------------------------------------------------------------------------
  it("records known schema/policy findings", () => {
    record(
      "F1",
      "~21 betk tables",
      "RLS-enabled / no policy",
      "FINDING",
      "RLS enabled but no policy => default-deny for non-admins (parent-scoped); " +
        "child-table policies (order_items, listing_images, inquiry_messages, etc.) " +
        "are expected to arrive in later phases per C3 §5.",
    );
    record(
      "F2",
      "orders/seller_profiles/payouts",
      "phone gate vs permissive INSERT",
      "FINDING",
      "orders & seller_profiles have the RESTRICTIVE phone gate but no permissive " +
        "INSERT policy yet, so direct authenticated inserts are default-denied; only " +
        "payouts has a permissive INSERT (payouts_insert) to pair with its gate.",
    );
    record(
      "F3",
      "listings / orders trigger",
      "decrement_stock_on_confirm",
      "FINDING",
      "BETK_ERD §7 lists 5 triggers but the source schema defines 4 — the " +
        "decrement_stock_on_confirm trigger (R-L05/06) is missing (carried from T05).",
    );
    expect(findings.length).toBeGreaterThan(0);
  });
});
