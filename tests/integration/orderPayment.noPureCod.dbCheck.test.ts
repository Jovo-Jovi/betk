/**
 * Phase 07 T03-evidence-topup (STEP 1d) — NO-PURE-COD, WHOLE-TABLE (OD-8 §3.2,
 * R-O04 retired). The existing no-pure-COD proof
 * (`tests/unit/checkoutRules.unit.test.ts`) is a Zod unit test on the INPUT
 * layer (`depositMethod: "cod"` fails `createOrderFromInquirySchema`). This is
 * the DB-level upgrade: query the LIVE `betk.orders`/`betk.payments` tables
 * (every row, not just this task's own fixtures) and assert the OD-8 §3.2
 * invariant holds table-wide — there is no order anywhere whose payment shape
 * is "pure COD" (a missing/duplicated payment row, a 'cod' deposit leg, or a
 * non-'cod' balance leg).
 *
 * One throwaway order is seeded first (service-role BARE insert — no
 * `create_order_from_inquiry` rpc, so no order_status_history row — fully
 * cleanable) so the assertion is never vacuously true on an empty table; it is
 * deleted in `afterAll` regardless of pass/fail (zero residue).
 *
 * RE-ENABLED (2026-07-24, RESIDUE-PURGE window) — the earlier 49→71 orphaned
 * rows were interrupted-run fixture residue (REG-71: `afterAll(purge)` never
 * fires on Ctrl-C/stop/timeout/crash; NOT a purge() defect — proven by a
 * completed full run that left ZERO residue). The 64 deletable orphans + their
 * full footprint were purged; the 7 that each carry an append-only
 * `order_status_history` row are UNDELETABLE (the `no_delete_order_history`
 * RULE rewrites the delete to a no-op and the `order_id` FK is NO ACTION →
 * sqlstate 23503) and remain as a documented residue class.
 *
 * This test now runs as a CANARY: it tolerates EXACTLY those 7 payment-less
 * orphans (EXPECTED_ORPHANS) and FAILS on the 8th with "new residue detected".
 * There is deliberately NO timestamp cutoff — a cutoff would excuse FUTURE
 * orphans as well as past ones (REG-71). Guard G (REG-74) is the suite-start
 * pre-flight that catches residue even earlier; this remains the DB-level
 * NO-PURE-COD shape proof (OD-8 §3.2).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P7Evi1d_${RUN}!`;
const service = createServiceClient();
const svc = () => service.schema("betk");

/**
 * Known staging append-only residue class (REG-71): 7 orders that each carry an
 * `order_status_history` row and are therefore UNDELETABLE (append-only RULE
 * no-ops the delete; `order_id` FK is NO ACTION). They legitimately have zero
 * `payments` rows. The canary tolerates exactly these and fails on any 8th.
 *   BETK-20260723-A04E  81147596-94ee-4a25-b634-34c043409242
 *   BETK-20260723-E239  b327bfb8-f807-418e-9448-1fb645351f3b
 *   BETK-20260723-E926  41c5b2c2-e5e0-4a60-9d28-3dc467a23a2a
 *   P7T02B-8cf7a1cb-L   e5d776fc-1402-484e-84c4-d2b441f5868f
 *   P7T02B-8cf7a1cb-M   02482319-a2a7-4b54-aaf1-8c24b5a95150
 *   P7T02B-a97d046c-L   da73deed-0670-4cc7-bccd-064b8d301b6f
 *   P7T02B-a97d046c-M   c7ba4f04-eefd-489a-b8de-5daa917e998b
 * Set to 0 once these are removed (e.g. by dropping the rule in a migration).
 */
const EXPECTED_ORPHANS = 7;

let seededOrderId: string | null = null;
let seededBuyerId: string | null = null;
let seededStoreId: string | null = null;
let seededSellerId: string | null = null;

async function seedThrowawayOrder(): Promise<void> {
  const { data: sellerAuth, error: sErr } = await service.auth.admin.createUser({
    email: `betk-p7evi-1d-seller-${RUN}@betk.test`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (sErr || !sellerAuth.user) throw new Error(`seed seller: ${sErr?.message}`);
  seededSellerId = sellerAuth.user.id;
  const { error: suErr } = await svc()
    .from("users")
    .insert({ id: seededSellerId, auth_provider: "phone", role: "seller" });
  if (suErr) throw new Error(`seed seller user row: ${suErr.message}`);
  const { error: spErr } = await svc().from("seller_profiles").insert({ id: seededSellerId, status: "active" });
  if (spErr) throw new Error(`seed seller_profiles: ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: seededSellerId,
      name_ar: `متجر 1d ${RUN}`,
      slug: `p7evi-1d-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`seed store: ${stErr?.message}`);
  seededStoreId = store.id;

  const { data: buyerAuth, error: bErr } = await service.auth.admin.createUser({
    email: `betk-p7evi-1d-buyer-${RUN}@betk.test`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (bErr || !buyerAuth.user) throw new Error(`seed buyer: ${bErr?.message}`);
  seededBuyerId = buyerAuth.user.id;
  const { error: buErr } = await svc()
    .from("users")
    .insert({ id: seededBuyerId, auth_provider: "phone", role: "buyer" });
  if (buErr) throw new Error(`seed buyer user row: ${buErr.message}`);

  const { data: order, error: oErr } = await svc()
    .from("orders")
    .insert({
      betk_ref: `P7EVI1D-${RUN}`,
      buyer_id: seededBuyerId,
      store_id: seededStoreId,
      delivery_method: "delivery",
      subtotal: 100,
      delivery_fee: 0,
      total_amount: 100,
      status: "pending",
    })
    .select("id")
    .single();
  if (oErr || !order) throw new Error(`seed order: ${oErr?.message}`);
  seededOrderId = order.id;

  const { error: pErr } = await svc()
    .from("payments")
    .insert([
      { order_id: seededOrderId, payment_type: "deposit", amount: 50, method: "instapay", status: "pending" },
      { order_id: seededOrderId, payment_type: "balance", amount: 50, method: "cod", status: "pending" },
    ]);
  if (pErr) throw new Error(`seed payments: ${pErr.message}`);
}

async function purge(): Promise<void> {
  if (seededOrderId) {
    await svc().from("payments").delete().eq("order_id", seededOrderId);
    await svc().from("orders").delete().eq("id", seededOrderId);
  }
  if (seededStoreId) await svc().from("stores").delete().eq("id", seededStoreId);
  if (seededSellerId) {
    await svc().from("seller_profiles").delete().eq("id", seededSellerId);
    await svc().from("users").delete().eq("id", seededSellerId);
    await service.auth.admin.deleteUser(seededSellerId).catch(() => undefined);
  }
  if (seededBuyerId) {
    await svc().from("users").delete().eq("id", seededBuyerId);
    await service.auth.admin.deleteUser(seededBuyerId).catch(() => undefined);
  }
}

// Credential-gated (staging); the beforeAll STAGING_GUARD pins the project ref.
const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 07 T03-evidence-topup / STEP 1d — NO-PURE-COD, whole-table (OD-8 §3.2)", () => {
  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }
    await seedThrowawayOrder();
  });

  afterAll(purge);

  it("orders with ≥1 payment have EXACTLY 2 (non-COD deposit + COD balance); payment-less orphans == EXPECTED_ORPHANS", async () => {
    const { data: orders, error: ordersErr } = await svc().from("orders").select("id, betk_ref");
    expect(ordersErr).toBeNull();
    // Never vacuous — the seeded throwaway order guarantees ≥1 order WITH payments.
    expect((orders ?? []).length).toBeGreaterThan(0);

    const { data: payments, error: paymentsErr } = await svc()
      .from("payments")
      .select("order_id, payment_type, method");
    expect(paymentsErr).toBeNull();

    const byOrder = new Map<string, { payment_type: string; method: string }[]>();
    for (const p of payments ?? []) {
      const list = byOrder.get(p.order_id) ?? [];
      list.push({ payment_type: p.payment_type, method: p.method });
      byOrder.set(p.order_id, list);
    }

    // (a) SHAPE — over every order that HAS ≥1 payment row: exactly one non-COD
    // deposit leg + one COD balance leg. Payment-less orders are orphans (b),
    // not shape violations — they are counted there, not asserted here.
    const shapeViolations: string[] = [];
    const paymentlessRefs: string[] = [];
    for (const o of orders ?? []) {
      const rows = byOrder.get(o.id) ?? [];
      if (rows.length === 0) {
        paymentlessRefs.push(o.betk_ref);
        continue;
      }
      if (rows.length !== 2) {
        shapeViolations.push(`${o.betk_ref}: ${rows.length} payment rows (expected exactly 2)`);
        continue;
      }
      const deposit = rows.find((r) => r.payment_type === "deposit");
      const balance = rows.find((r) => r.payment_type === "balance");
      if (!deposit || deposit.method === "cod") {
        shapeViolations.push(`${o.betk_ref}: deposit leg missing or method='cod' (pure-COD deposit)`);
      }
      if (!balance || balance.method !== "cod") {
        shapeViolations.push(`${o.betk_ref}: balance leg missing or method!='cod'`);
      }
    }
    expect(shapeViolations).toEqual([]);

    // (b) ORPHAN CANARY — payment-less orders must equal the known append-only
    // residue class EXACTLY (no timestamp cutoff — a cutoff would excuse future
    // orphans too). A HIGHER count means a NEW interrupted-run orphan slipped in
    // (REG-71 root cause: afterAll(purge) skipped on interrupt) → fail loudly.
    if (paymentlessRefs.length > EXPECTED_ORPHANS) {
      throw new Error(
        `new residue detected: ${paymentlessRefs.length} payment-less orders ` +
          `(EXPECTED_ORPHANS=${EXPECTED_ORPHANS}). Refs: ${paymentlessRefs.sort().join(", ")}. ` +
          `A new orphan means an integration run was interrupted before afterAll(purge) — see REG-71/REG-74.`,
      );
    }
    expect(paymentlessRefs.length).toBe(EXPECTED_ORPHANS);
  });
});
