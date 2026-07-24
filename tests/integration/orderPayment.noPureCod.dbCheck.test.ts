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
 * ⚠️ BLOCKED / SKIPPED (2026-07-24, Phase 07 T04 window, explicit user
 * instruction) — the LIVE staging `betk.orders` table carries 49 PRE-EXISTING
 * orphaned rows (zero `payments` rows each, from earlier interrupted test
 * runs — none created by this window) that legitimately fail this whole-table
 * assertion. The user directed: do NOT touch any order/payment row not
 * created in this window; move the cleanup to a dedicated RESIDUE-PURGE
 * window; the NO-PURE-COD ledger line stays PARTIAL (unit-layer only) until
 * then. The `describe.skip` below (not the credential gate) is the recorded
 * blocker — re-enable (`describe`) once the residue is purged; do not delete
 * this test.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P7Evi1d_${RUN}!`;
const service = createServiceClient();
const svc = () => service.schema("betk");

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

// BLOCKED (see file header) — skip the whole suite so beforeAll/afterAll
// don't perform pointless staging writes for a test that can't pass yet.
describe.skip("Phase 07 T03-evidence-topup / STEP 1d — NO-PURE-COD, whole-table (OD-8 §3.2)", () => {
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

  it("EVERY order in the live table has exactly 2 payments: one non-COD deposit + one COD balance", async () => {
    const { data: orders, error: ordersErr } = await svc().from("orders").select("id, betk_ref");
    expect(ordersErr).toBeNull();
    // Never vacuous — the seeded throwaway order guarantees at least 1 row exists.
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

    const violations: string[] = [];
    for (const o of orders ?? []) {
      const rows = byOrder.get(o.id) ?? [];
      if (rows.length !== 2) {
        violations.push(`${o.betk_ref}: ${rows.length} payment rows (expected exactly 2)`);
        continue;
      }
      const deposit = rows.find((r) => r.payment_type === "deposit");
      const balance = rows.find((r) => r.payment_type === "balance");
      if (!deposit || deposit.method === "cod") {
        violations.push(`${o.betk_ref}: deposit leg missing or method='cod' (pure-COD deposit)`);
      }
      if (!balance || balance.method !== "cod") {
        violations.push(`${o.betk_ref}: balance leg missing or method!='cod'`);
      }
    }

    expect(violations).toEqual([]);
  });
});
