/**
 * Stock-decrement trigger integration tests — R2 (open-issue #4).
 *
 * Proves the `trg_decrement_stock_on_confirm` trigger (migrations
 * 20260716124323_decrement_stock_on_confirm.sql +
 * 20260716125122_harden_decrement_stock_fn_execute.sql) against STAGING.
 *
 * Spec (BETK_ERD.md §7, R-L05/R-L06): on an order's transition INTO 'confirmed'
 * (seller confirm — NOT at checkout), decrement each ordered listing's tracked
 * stock_qty by the ordered quantity, and flip an ACTIVE listing to 'sold_out'
 * when its stock reaches 0. Untracked stock (stock_qty IS NULL) is left alone;
 * the listings CHECK (stock_qty >= 0) is the oversell backstop.
 *
 * Seeds via the service-role client (orders INSERT is default-denied for
 * `authenticated` — OD-4 phone-gate RESTRICTIVE policy), drives the status
 * transition via service-role UPDATE (which fires the trigger), then reads the
 * listing rows back. Cleans up to zero residue.
 *
 * T02b UPDATE (REG-49, migration 20260723140552): the pending→confirmed UPDATE now
 * also fires the BEFORE trigger `enforce_order_transition`, whose AC-SEL-14 gate
 * RAISEs BETK_DEPOSIT_UNCONFIRMED unless the order has a `status='confirmed'`
 * deposit payment. So each seeded order now carries a confirmed deposit (seeded
 * directly — an INSERT does not fire the UPDATE-only payment trigger). The
 * store-only actor check is skipped under service-role (my_store_id() is NULL, so
 * `IF NOT (store_id = NULL)` is NULL → not taken), leaving the deposit gate as the
 * only added precondition. This keeps the AFTER stock trigger the subject under test.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type ListingStatus = Database["betk"]["Enums"]["listing_status"];

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function extractProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

const RUN = randomUUID().slice(0, 8);
const createdAuthIds: string[] = [];

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("R2 — decrement_stock_on_confirm trigger (staging, service-role)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");

  let sellerId = "";
  let buyerId = "";
  let storeId = "";
  let categoryId = "";

  // per-scenario listing + order ids
  let listingA = "";
  let listingB = "";
  let listingC1 = "";
  let listingC2 = "";
  let listingD = "";
  let listingE = "";
  let listingF = "";
  let orderA = "";
  let orderB = "";
  let orderC = "";
  let orderD = "";
  let orderE = "";
  let orderF = "";
  const listingIds: string[] = [];
  const orderIds: string[] = [];

  async function seedListing(label: string, stockQty: number | null, status: ListingStatus = "active"): Promise<string> {
    const { data, error } = await svc()
      .from("listings")
      .insert({
        store_id: storeId,
        category_id: categoryId,
        type: "product",
        title_ar: `منتج ${label} ${RUN}`,
        price: 100,
        price_type: "fixed",
        stock_qty: stockQty,
        status,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`[stock.test] listing ${label}: ${error?.message}`);
    listingIds.push(data.id);
    return data.id;
  }

  async function seedOrder(label: string, items: { listingId: string; qty: number }[]): Promise<string> {
    const subtotal = items.reduce((s, it) => s + it.qty * 100, 0);
    const { data: order, error } = await svc()
      .from("orders")
      .insert({
        betk_ref: `R2-${label}-${RUN}`,
        buyer_id: buyerId,
        store_id: storeId,
        delivery_method: "delivery",
        subtotal,
        delivery_fee: 0,
        total_amount: subtotal,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !order) throw new Error(`[stock.test] order ${label}: ${error?.message}`);
    orderIds.push(order.id);

    const rows = items.map((it) => ({
      order_id: order.id,
      listing_id: it.listingId,
      listing_title_ar: `منتج ${RUN}`,
      quantity: it.qty,
      unit_price: 100,
      subtotal: it.qty * 100,
    }));
    const { error: itemErr } = await svc().from("order_items").insert(rows);
    if (itemErr) throw new Error(`[stock.test] order_items ${label}: ${itemErr.message}`);

    // AC-SEL-14 (T02b): confirm requires a confirmed deposit. Seed one directly
    // (INSERT bypasses the UPDATE-only enforce_payment_update trigger).
    const { error: payErr } = await svc().from("payments").insert({
      order_id: order.id,
      payment_type: "deposit",
      amount: subtotal / 2,
      method: "instapay",
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    });
    if (payErr) throw new Error(`[stock.test] deposit seed ${label}: ${payErr.message}`);
    return order.id;
  }

  function confirm(orderId: string) {
    return svc()
      .from("orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", orderId);
  }

  async function readListing(id: string): Promise<{ stock_qty: number | null; status: ListingStatus }> {
    const { data, error } = await svc().from("listings").select("stock_qty, status").eq("id", id).single();
    if (error || !data) throw new Error(`[stock.test] read listing ${id}: ${error?.message}`);
    return data;
  }

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }

    const { data: sellerAuth, error: sErr } = await service.auth.admin.createUser({
      email: `betk-r2-seller-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (sErr || !sellerAuth.user) throw new Error(`[stock.test] seller createUser: ${sErr?.message}`);
    sellerId = sellerAuth.user.id;
    createdAuthIds.push(sellerId);
    await svc()
      .from("users")
      .insert({ id: sellerId, phone_number: `0100${RUN}`, auth_provider: "phone", role: "seller" });
    await svc().from("seller_profiles").insert({ id: sellerId, status: "active" });

    const { data: buyerAuth, error: bErr } = await service.auth.admin.createUser({
      email: `betk-r2-buyer-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (bErr || !buyerAuth.user) throw new Error(`[stock.test] buyer createUser: ${bErr?.message}`);
    buyerId = buyerAuth.user.id;
    createdAuthIds.push(buyerId);
    await svc().from("users").insert({ id: buyerId, phone_number: `0101${RUN}`, auth_provider: "phone" });

    const { data: cat, error: cErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة R2 ${RUN}`, slug: `r2-cat-${RUN}`, is_active: true, sort_order: 999 })
      .select("id")
      .single();
    if (cErr || !cat) throw new Error(`[stock.test] category: ${cErr?.message}`);
    categoryId = cat.id;

    const { data: store, error: stErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر R2 ${RUN}`,
        slug: `r2-store-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
        status: "active",
      })
      .select("id")
      .single();
    if (stErr || !store) throw new Error(`[stock.test] store: ${stErr?.message}`);
    storeId = store.id;

    // Scenario fixtures
    listingA = await seedListing("A", 3); // exact → 0 → sold_out
    listingB = await seedListing("B", 10); // partial → 6, stays active
    listingC1 = await seedListing("C1", 5);
    listingC2 = await seedListing("C2", 8);
    listingD = await seedListing("D", null); // untracked stock (service / made-to-order)
    listingE = await seedListing("E", 7); // idempotency
    listingF = await seedListing("F", 2); // oversell → CHECK guard

    orderA = await seedOrder("A", [{ listingId: listingA, qty: 3 }]);
    orderB = await seedOrder("B", [{ listingId: listingB, qty: 4 }]);
    orderC = await seedOrder("C", [
      { listingId: listingC1, qty: 2 },
      { listingId: listingC2, qty: 3 },
    ]);
    orderD = await seedOrder("D", [{ listingId: listingD, qty: 2 }]);
    orderE = await seedOrder("E", [{ listingId: listingE, qty: 1 }]);
    orderF = await seedOrder("F", [{ listingId: listingF, qty: 5 }]);
  });

  afterAll(async () => {
    for (const id of orderIds) {
      await svc().from("order_items").delete().eq("order_id", id);
      await svc().from("payments").delete().eq("order_id", id);
    }
    if (storeId) await svc().from("orders").delete().eq("store_id", storeId);
    for (const id of listingIds) {
      await svc().from("listings").delete().eq("id", id);
    }
    if (storeId) await svc().from("stores").delete().eq("id", storeId);
    if (categoryId) await svc().from("categories").delete().eq("id", categoryId);
    if (sellerId) await svc().from("seller_profiles").delete().eq("id", sellerId);
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it("exact-stock confirm → stock 0 AND active listing flips to 'sold_out' (R-L06)", async () => {
    const { error } = await confirm(orderA);
    expect(error).toBeNull();
    const row = await readListing(listingA);
    expect(row.stock_qty).toBe(0);
    expect(row.status).toBe("sold_out");
  });

  it("partial confirm → decrements by ordered quantity; stays 'active' (R-L05)", async () => {
    const { error } = await confirm(orderB);
    expect(error).toBeNull();
    const row = await readListing(listingB);
    expect(row.stock_qty).toBe(6); // 10 - 4
    expect(row.status).toBe("active");
  });

  it("multi-item order → each listing decremented by its own quantity", async () => {
    const { error } = await confirm(orderC);
    expect(error).toBeNull();
    const c1 = await readListing(listingC1);
    const c2 = await readListing(listingC2);
    expect(c1.stock_qty).toBe(3); // 5 - 2
    expect(c2.stock_qty).toBe(5); // 8 - 3
    expect(c1.status).toBe("active");
    expect(c2.status).toBe("active");
  });

  it("untracked stock (stock_qty NULL) is left unchanged and never flips to sold_out", async () => {
    const { error } = await confirm(orderD);
    expect(error).toBeNull();
    const row = await readListing(listingD);
    expect(row.stock_qty).toBeNull();
    expect(row.status).toBe("active");
  });

  it("fires only on the transition INTO 'confirmed' — no double-decrement on confirmed→preparing", async () => {
    const { error } = await confirm(orderE);
    expect(error).toBeNull();
    let row = await readListing(listingE);
    expect(row.stock_qty).toBe(6); // 7 - 1, fired once

    const { error: err2 } = await svc().from("orders").update({ status: "preparing" }).eq("id", orderE);
    expect(err2).toBeNull();
    row = await readListing(listingE);
    expect(row.stock_qty).toBe(6); // unchanged — trigger did NOT re-fire
  });

  it("oversell is blocked by the listings CHECK (stock_qty >= 0); confirm rolls back", async () => {
    const { error } = await confirm(orderF); // stock 2, qty 5 → would be -3
    expect(error).not.toBeNull(); // CHECK violation surfaces as an error

    const row = await readListing(listingF);
    expect(row.stock_qty).toBe(2); // unchanged — statement rolled back

    const { data: order } = await svc().from("orders").select("status").eq("id", orderF).single();
    expect(order?.status).toBe("pending"); // confirm did not commit
  });
});
