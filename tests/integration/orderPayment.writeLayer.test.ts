/**
 * Phase 07 / T02b — REG-49 order/payment write layer (staging integration).
 *
 * Proves the three-layer authz (ADR-019: column GRANT + row policy + OLD-aware
 * trigger) on payments + orders, the settings_payment_config_read allow-list
 * (REG-69), the commission BEFORE-INSERT snapshot + converted_to_order_id trigger,
 * and the Server-Action outcomes that do NOT create an order. Mints real GoTrue
 * users, exercises every leg through RLS-respecting authenticated clients
 * (service-role only seeds/tears down), and cleans to ZERO residue.
 *
 * ZERO-RESIDUE DESIGN: the `create_order_from_inquiry` rpc + the transition
 * Server Actions (cancel/accept/preparing) each INSERT an `order_status_history`
 * row, which is UNDELETABLE (the append-only `no_delete_order_history` RULE
 * rewrites deletes to no-ops for every role, and its order_id FK is NO ACTION) →
 * such an order can never be torn down. So the DEFAULT suite proves the whole
 * write layer with RAW DB ops on BARE orders (direct inserts fire the BEFORE-INSERT
 * commission + AFTER-INSERT conversion triggers but write NO history → fully
 * cleanable). The rpc atomicity + action-driven transitions (the only history
 * writers) are OPT-IN behind RUN_ORDER_RESIDUE=1 (the order.rls RUN_APPEND_ONLY
 * precedent), documented as leaving residue.
 *
 * The Server Actions read their client via `@/lib/supabase/server` createClient,
 * mocked to the current test's authenticated client (the T02-Phase-05 precedent);
 * getUserRowById-style gate reads use the real service client.
 *
 * Assertions prove the ERROR (code/message), not merely a 0-row no-op, wherever a
 * GRANT (42501) or a trigger RAISE is the load-bearing denial.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ── Mock the cookie client → the current test's authenticated client ─────────
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { createOrderFromInquiry } from "@/features/checkout/actions/createOrderFromInquiry";
import { confirmDepositPayment } from "@/features/orders/actions/confirmDepositPayment";
import { cancelOrder } from "@/features/orders/actions/cancelOrder";
import { acceptOrder } from "@/features/orders/actions/acceptOrder";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Opt-in: the rpc + transition-action tests write UNDELETABLE order_status_history
// rows (see header). OFF by default so CI stays zero-residue.
const RUN_ORDER_RESIDUE = process.env.RUN_ORDER_RESIDUE === "1";

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P7T02b_${RUN}!`;
const EMAIL_PREFIX = "betk-p7t02b-";
const REF_PREFIX = `P7T02B-${RUN}`;

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];

/** The 4 keys settings_payment_config_read exposes to authenticated (REG-69). */
const ALLOWED_SETTING_KEYS = [
  "betk_instapay_handle",
  "betk_vodafone_cash",
  "betk_orange_cash",
  "delivery_fee_flat_egp",
].sort();
const HIDDEN_SETTING_KEYS = ["commission_rate_pct", "return_hold_hours"];

function anonClient(): BetkClient {
  return createClient<Database, "betk">(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: "betk" }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

let phoneCounter = 0;
function makePhone(): string {
  const base = parseInt(RUN.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2010${n.toString().padStart(8, "0")}`;
}

async function signIn(email: string): Promise<BetkClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

interface Actor {
  id: string;
  client: BetkClient;
}
interface Seller extends Actor {
  storeId: string;
}

async function createUserRow(label: string, role: "buyer" | "seller" | "admin", phone: string | null) {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: phone, auth_provider: phone ? "phone" : "google", role });
  if (uErr) throw new Error(`users seed(${label}): ${uErr.message}`);
  return { id, email };
}

async function createBuyer(label: string, phone: string | null = makePhone()): Promise<Actor> {
  const { id, email } = await createUserRow(label, "buyer", phone);
  return { id, client: await signIn(email) };
}

async function createAdmin(label: string): Promise<Actor> {
  const { id, email } = await createUserRow(label, "admin", makePhone());
  return { id, client: await signIn(email) };
}

async function createSeller(label: string): Promise<Seller> {
  const { id, email } = await createUserRow(label, "seller", makePhone());
  const { error: spErr } = await svc().from("seller_profiles").insert({ id, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed(${label}): ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: id,
      name_ar: `متجر ${label} ${RUN}`,
      slug: `p7t02b-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
      delivery_options: { modes: ["delivery", "pickup", "remote"] },
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}): ${stErr?.message}`);
  return { id, client: await signIn(email), storeId: store.id };
}

/** Seed a BARE order (service INSERT — no history row). */
let orderRefCounter = 0;
async function seedOrder(
  label: string,
  buyerId: string,
  storeId: string,
  status: Database["betk"]["Enums"]["order_status"] = "pending",
  opts: { subtotal?: number; inquiryId?: string } = {},
): Promise<string> {
  const subtotal = opts.subtotal ?? 200;
  // betk_ref is VARCHAR(25); build a short, unique, label-independent ref
  // (REF_PREFIX=15 chars + "-" + counter) so no label ever overflows the column.
  const { data, error } = await svc()
    .from("orders")
    .insert({
      betk_ref: `${REF_PREFIX}-${(orderRefCounter++).toString(36).toUpperCase()}`,
      buyer_id: buyerId,
      store_id: storeId,
      inquiry_id: opts.inquiryId ?? null,
      delivery_method: "delivery",
      subtotal,
      delivery_fee: 0,
      total_amount: subtotal,
      status,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`[order ${label}] seed: ${error?.message}`);
  return data.id;
}

/** Seed a payment row directly (INSERT does NOT fire the UPDATE-only trigger). */
async function seedPayment(
  orderId: string,
  type: "deposit" | "balance",
  status: Database["betk"]["Enums"]["payment_status"] = "pending",
): Promise<string> {
  const { data, error } = await svc()
    .from("payments")
    .insert({
      order_id: orderId,
      payment_type: type,
      amount: 100,
      method: type === "deposit" ? "instapay" : "cod",
      status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`[payment ${type}] seed: ${error?.message}`);
  return data.id;
}

async function seedConfirmedInquiry(buyerId: string, storeId: string, listingId: string): Promise<string> {
  const { data, error } = await svc()
    .from("inquiries")
    .insert({
      buyer_id: buyerId,
      store_id: storeId,
      listing_id: listingId,
      buyer_first_message: `checkout ${RUN}`,
      status: "confirmed",
      quantity: 1,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`inquiry seed: ${error?.message}`);
  return data.id;
}

async function purge(): Promise<void> {
  const db = svc();
  const { data: stores } = await db.from("stores").select("id").in("seller_id", createdAuthIds);
  const storeIds = (stores ?? []).map((s) => s.id);

  const orderIdSet = new Set<string>();
  const { data: ob } = await db.from("orders").select("id").in("buyer_id", createdAuthIds);
  for (const o of ob ?? []) orderIdSet.add(o.id);
  if (storeIds.length) {
    const { data: os } = await db.from("orders").select("id").in("store_id", storeIds);
    for (const o of os ?? []) orderIdSet.add(o.id);
  }
  const orderIds = [...orderIdSet];

  if (orderIds.length) {
    await db.from("inquiries").update({ converted_to_order_id: null }).in("converted_to_order_id", orderIds);
    await db.from("order_items").delete().in("order_id", orderIds);
    await db.from("payments").delete().in("order_id", orderIds);
    // order_status_history is append-only + un-cascaded; delete no-ops. Only the
    // opt-in RUN_ORDER_RESIDUE tests create such rows (documented residue).
    await db.from("orders").delete().in("id", orderIds);
  }

  await db.from("inquiries").delete().in("buyer_id", createdAuthIds);
  if (storeIds.length) {
    await db.from("inquiries").delete().in("store_id", storeIds);
    await db.from("listings").delete().in("store_id", storeIds);
    await db.from("addresses").delete().in("buyer_id", createdAuthIds);
    await db.from("stores").delete().in("id", storeIds);
  }
  await db.from("seller_profiles").delete().in("id", createdAuthIds);
  await db.from("users").delete().in("id", createdAuthIds);
  for (const id of createdAuthIds) {
    await service.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 07 / T02b — REG-49 write layer (staging)", () => {
  let sellerA: Seller;
  let sellerB: Seller;
  let buyer: Actor;
  let buyer2: Actor;
  let admin: Actor;
  let phoneNull: Actor;
  let listingA: string;
  let categoryId: string;

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category: ${catErr?.message}`);
    categoryId = cat.id;

    sellerA = await createSeller("sellera");
    sellerB = await createSeller("sellerb");
    buyer = await createBuyer("buyer");
    buyer2 = await createBuyer("buyer2");
    admin = await createAdmin("admin");
    phoneNull = await createBuyer("nophone", null);

    const { data: listing, error: lErr } = await svc()
      .from("listings")
      .insert({
        store_id: sellerA.storeId,
        category_id: categoryId,
        type: "product",
        title_ar: `منتج ${RUN}`,
        price: 100,
        price_type: "fixed",
        status: "active",
      })
      .select("id")
      .single();
    if (lErr || !listing) throw new Error(`listing seed: ${lErr?.message}`);
    listingA = listing.id;

    // A buyer address (for the opt-in rpc block).
    await svc()
      .from("addresses")
      .insert({ buyer_id: buyer.id, governorate: "Cairo", city: "Nasr City", street_address: `st ${RUN}` });
  });

  afterAll(purge);

  // ═══ settings_payment_config_read (REG-69 allow-list) ══════════════════════
  it("allow-list: authenticated non-admin SELECTs EXACTLY the 4 config keys; commission/return_hold hidden (both directions)", async () => {
    const { data } = await buyer.client.from("admin_settings").select("key");
    const keys = (data ?? []).map((r) => r.key).sort();
    expect(keys).toEqual(ALLOWED_SETTING_KEYS);

    for (const hidden of HIDDEN_SETTING_KEYS) {
      const { data: row } = await buyer.client.from("admin_settings").select("key").eq("key", hidden);
      expect(row?.length ?? 0).toBe(0);
    }
    // positive direction: each allow-listed key is individually readable
    for (const k of ALLOWED_SETTING_KEYS) {
      const { data: row } = await buyer.client.from("admin_settings").select("key").eq("key", k);
      expect(row?.length ?? 0).toBe(1);
    }
  });

  it("allow-list: anon SELECTs ZERO admin_settings rows; admin sees all 6", async () => {
    const { data: anon } = await anonClient().from("admin_settings").select("key");
    expect(anon?.length ?? 0).toBe(0);

    const { data: asAdmin } = await admin.client.from("admin_settings").select("key");
    expect((asAdmin?.length ?? 0)).toBeGreaterThanOrEqual(ALLOWED_SETTING_KEYS.length + HIDDEN_SETTING_KEYS.length);
    const adminKeys = (asAdmin ?? []).map((r) => r.key);
    for (const hidden of HIDDEN_SETTING_KEYS) expect(adminKeys).toContain(hidden);
  });

  // ═══ commission snapshot (BEFORE INSERT trigger) + converted_to_order_id ═══
  it("commission snapshot: a BARE order insert stamps commission_rate + amount = round(rate/100 × subtotal)", async () => {
    const { data: cfg } = await svc().from("admin_settings").select("value").eq("key", "commission_rate_pct").single();
    const rate = Number((cfg?.value ?? "0").trim() || "0");

    const subtotal = 350;
    const orderId = await seedOrder("commission", buyer.id, sellerA.storeId, "pending", { subtotal });
    const { data: order } = await svc()
      .from("orders")
      .select("commission_rate, commission_amount")
      .eq("id", orderId)
      .single();
    expect(Number(order?.commission_rate)).toBe(rate);
    expect(Number(order?.commission_amount)).toBe(Math.round((rate / 100) * subtotal * 100) / 100);
  });

  it("converted_to_order_id: a BARE order with inquiry_id sets the link once (ADR-017 trigger)", async () => {
    const inqId = await seedConfirmedInquiry(buyer.id, sellerA.storeId, listingA);
    const orderId = await seedOrder("conv", buyer.id, sellerA.storeId, "pending", { inquiryId: inqId });
    const { data: inq } = await svc().from("inquiries").select("converted_to_order_id").eq("id", inqId).single();
    expect(inq?.converted_to_order_id).toBe(orderId);
  });

  // ═══ payments INSERT (REG-49) — buyer-of-parent both directions ════════════
  it("payments INSERT: buyer inserts deposit+balance on OWN order; buyer2 + anon DENIED", async () => {
    const orderId = await seedOrder("pins", buyer.id, sellerA.storeId);
    const rows = [
      { order_id: orderId, payment_type: "deposit" as const, amount: 100, method: "instapay" as const, status: "pending" as const },
      { order_id: orderId, payment_type: "balance" as const, amount: 100, method: "cod" as const, status: "pending" as const },
    ];
    const ok = await buyer.client.from("payments").insert(rows).select("id");
    expect(ok.error).toBeNull();
    expect(ok.data?.length ?? 0).toBe(2);

    const cross = await buyer2.client
      .from("payments")
      .insert({ order_id: orderId, payment_type: "deposit", amount: 1, method: "instapay", status: "pending" })
      .select("id");
    expect(cross.error).not.toBeNull(); // RLS WITH CHECK violation (uq also would, but this is a new order-scope)

    const byAnon = await anonClient()
      .from("payments")
      .insert({ order_id: orderId, payment_type: "balance", amount: 1, method: "cod", status: "pending" })
      .select("id");
    expect(byAnon.error).not.toBeNull();
  });

  // ═══ payments UPDATE — three-layer denials ═════════════════════════════════
  it("payments UPDATE: buyer amount change DENIED BY THE GRANT (42501)", async () => {
    const orderId = await seedOrder("pamt", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const res = await buyer.client.from("payments").update({ amount: 1 }).eq("id", depId).select("id");
    expect(res.error?.code).toBe("42501");
  });

  it("payments UPDATE: buyer status change DENIED BY THE TRIGGER (BETK_PAYMENT_ADMIN_ONLY, not a 0-row no-op)", async () => {
    const orderId = await seedOrder("pstat", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const res = await buyer.client.from("payments").update({ status: "confirmed" }).eq("id", depId).select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_PAYMENT_ADMIN_ONLY");
  });

  it("payments UPDATE: seller has NO payments UPDATE (row policy excludes seller → 0 rows)", async () => {
    const orderId = await seedOrder("psell", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const res = await sellerA.client
      .from("payments")
      .update({ proof_path: `${sellerA.id}/x.jpg` })
      .eq("id", depId)
      .select("id");
    expect(res.error).toBeNull();
    expect(res.data?.length ?? 0).toBe(0);
  });

  // ═══ proof attach (buyer, own pending deposit only) ════════════════════════
  it("proof attach: buyer attaches to OWN pending deposit OK; BALANCE row + another buyer DENIED", async () => {
    const orderId = await seedOrder("pproof", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const balId = await seedPayment(orderId, "balance", "pending");

    const ok = await buyer.client
      .from("payments")
      .update({ proof_path: `${buyer.id}/proof.jpg`, transfer_reference: "REF1" })
      .eq("id", depId)
      .select("id");
    expect(ok.error).toBeNull();
    expect(ok.data?.length ?? 0).toBe(1);

    const onBalance = await buyer.client
      .from("payments")
      .update({ proof_path: `${buyer.id}/x.jpg` })
      .eq("id", balId)
      .select("id");
    expect(onBalance.error).not.toBeNull();
    expect(onBalance.error?.message).toContain("BETK_PAYMENT_PROOF_FORBIDDEN");

    const byOther = await buyer2.client
      .from("payments")
      .update({ proof_path: `${buyer2.id}/x.jpg` })
      .eq("id", depId)
      .select("id");
    expect(byOther.error).toBeNull();
    expect(byOther.data?.length ?? 0).toBe(0); // RLS excludes non-parent buyer
  });

  // ═══ admin confirm (action) + idempotency + post-confirm proof denial ══════
  it("confirmDepositPayment (admin): confirms a pending deposit; idempotent; post-confirm buyer proof DENIED", async () => {
    const orderId = await seedOrder("pconf", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");

    h.client = admin.client;
    const res = await confirmDepositPayment({ paymentId: depId });
    expect(res).toEqual({ ok: true, alreadyConfirmed: false });

    const { data: after } = await svc().from("payments").select("status, confirmed_by").eq("id", depId).single();
    expect(after?.status).toBe("confirmed");
    expect(after?.confirmed_by).toBe(admin.id);

    // Idempotent re-confirm.
    expect(await confirmDepositPayment({ paymentId: depId })).toEqual({ ok: true, alreadyConfirmed: true });

    // Buyer can no longer attach proof once confirmed (trigger: OLD.status != pending).
    const late = await buyer.client
      .from("payments")
      .update({ proof_path: `${buyer.id}/late.jpg` })
      .eq("id", depId)
      .select("id");
    expect(late.error).not.toBeNull();
    expect(late.error?.message).toContain("BETK_PAYMENT_PROOF_FORBIDDEN");
  });

  it("confirmDepositPayment: non-admin → forbidden; balance row → invalid_state", async () => {
    const orderId = await seedOrder("pnadm", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const balId = await seedPayment(orderId, "balance", "pending");

    h.client = buyer.client;
    expect(await confirmDepositPayment({ paymentId: depId })).toEqual({ ok: false, reason: "forbidden" });

    h.client = admin.client;
    expect(await confirmDepositPayment({ paymentId: balId })).toEqual({ ok: false, reason: "invalid_state" });
  });

  // ═══ F2 — payment transition legality (pending→confirmed ONLY) ═════════════
  it("F2: admin flipping a CONFIRMED deposit back to pending RAISEs BETK_ILLEGAL_PAYMENT_TRANSITION", async () => {
    const orderId = await seedOrder("f2back", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "confirmed");
    const res = await admin.client.from("payments").update({ status: "pending" }).eq("id", depId).select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_ILLEGAL_PAYMENT_TRANSITION");
  });

  it("F2: admin setting a pending deposit to 'refunded' RAISEs BETK_ILLEGAL_PAYMENT_TRANSITION (Phase 10/14)", async () => {
    const orderId = await seedOrder("f2ref", buyer.id, sellerA.storeId);
    const depId = await seedPayment(orderId, "deposit", "pending");
    const res = await admin.client.from("payments").update({ status: "refunded" }).eq("id", depId).select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_ILLEGAL_PAYMENT_TRANSITION");
  });

  // ═══ orders UPDATE — grant + transition triggers (raw, no history) ═════════
  it("orders UPDATE: buyer total_amount change DENIED BY THE GRANT (42501)", async () => {
    const orderId = await seedOrder("ototal", buyer.id, sellerA.storeId);
    const res = await buyer.client.from("orders").update({ total_amount: 1 }).eq("id", orderId).select("id");
    expect(res.error?.code).toBe("42501");
  });

  it("buyer cancel from pending: raw UPDATE succeeds AND the trigger stamps cancelled_by='buyer' (client never supplies it)", async () => {
    const orderId = await seedOrder("ocancel", buyer.id, sellerA.storeId, "pending");
    const res = await buyer.client.from("orders").update({ status: "cancelled" }).eq("id", orderId).select("id");
    expect(res.error).toBeNull();
    expect(res.data?.length ?? 0).toBe(1);
    const { data: after } = await svc().from("orders").select("status, cancelled_by").eq("id", orderId).single();
    expect(after?.status).toBe("cancelled");
    expect(after?.cancelled_by).toBe("buyer"); // server-stamped
  });

  it("buyer cancel from a NON-pending order RAISEs BETK_NOT_CANCELLABLE", async () => {
    const orderId = await seedOrder("onocancel", buyer.id, sellerA.storeId, "confirmed");
    const res = await buyer.client.from("orders").update({ status: "cancelled" }).eq("id", orderId).select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_NOT_CANCELLABLE");
  });

  // ═══ F1 — cancel-metadata guard OUTSIDE the status branch ══════════════════
  it("F1: buyer rewriting cancellation_reason on a NON-pending order RAISEs BETK_CANCEL_METADATA_FORBIDDEN", async () => {
    const orderId = await seedOrder("f1buyer", buyer.id, sellerA.storeId, "confirmed");
    const res = await buyer.client
      .from("orders")
      .update({ cancellation_reason: "late" })
      .eq("id", orderId)
      .select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_CANCEL_METADATA_FORBIDDEN");
  });

  it("F1: seller rewriting cancellation_reason on a NON-pending store order RAISEs BETK_CANCEL_METADATA_FORBIDDEN", async () => {
    const orderId = await seedOrder("f1seller", buyer.id, sellerA.storeId, "confirmed");
    const res = await sellerA.client
      .from("orders")
      .update({ cancellation_reason: "seller note" })
      .eq("id", orderId)
      .select("id");
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toContain("BETK_CANCEL_METADATA_FORBIDDEN");
  });

  // ═══ seller accept custodial gate (AC-SEL-14, DB-authoritative, both dirs) ══
  it("seller accept BLOCKED while deposit pending (BETK_DEPOSIT_UNCONFIRMED) and ALLOWED once confirmed", async () => {
    const orderId = await seedOrder("oaccept", buyer.id, sellerA.storeId, "pending");
    const depId = await seedPayment(orderId, "deposit", "pending");

    // Blocked: raw seller confirm while the deposit is unconfirmed.
    const blocked = await sellerA.client.from("orders").update({ status: "confirmed" }).eq("id", orderId).select("id");
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.message).toContain("BETK_DEPOSIT_UNCONFIRMED");

    // Admin confirms the deposit (through the trigger's admin branch).
    const conf = await admin.client
      .from("payments")
      .update({ status: "confirmed", confirmed_by: admin.id, confirmed_at: new Date().toISOString() })
      .eq("id", depId)
      .select("id");
    expect(conf.error).toBeNull();

    // Allowed: the same raw seller confirm now passes; confirmed_at stamped.
    const allowed = await sellerA.client.from("orders").update({ status: "confirmed" }).eq("id", orderId).select("id");
    expect(allowed.error).toBeNull();
    expect(allowed.data?.length ?? 0).toBe(1);
    const { data: after } = await svc().from("orders").select("status, confirmed_at").eq("id", orderId).single();
    expect(after?.status).toBe("confirmed");
    expect(after?.confirmed_at).not.toBeNull();
  });

  it("cross-store seller cannot accept another store's order (BETK_ORDER_ACCEPT_STORE_ONLY / 0 rows)", async () => {
    const orderId = await seedOrder("oxstore", buyer.id, sellerA.storeId, "pending");
    await seedPayment(orderId, "deposit", "confirmed");
    // sellerB is not the store owner: orders_update USING (store_id=my_store_id) is
    // false for sellerB and they are not the buyer → 0 rows (RLS denial).
    const res = await sellerB.client.from("orders").update({ status: "confirmed" }).eq("id", orderId).select("id");
    expect(res.error).toBeNull();
    expect(res.data?.length ?? 0).toBe(0);
  });

  // ═══ transition ACTIONS — failure branches (return BEFORE any history write) ═
  it("acceptOrder (seller): deposit still pending → deposit_unconfirmed (no mutation, no history)", async () => {
    const orderId = await seedOrder("aunconf", buyer.id, sellerA.storeId, "pending");
    await seedPayment(orderId, "deposit", "pending");
    h.client = sellerA.client;
    expect(await acceptOrder({ orderId })).toEqual({ ok: false, reason: "deposit_unconfirmed" });
    const { data: after } = await svc().from("orders").select("status").eq("id", orderId).single();
    expect(after?.status).toBe("pending"); // untouched
  });

  it("cancelOrder (buyer): a confirmed order → not_cancellable (no mutation, no history)", async () => {
    const orderId = await seedOrder("cnocancel", buyer.id, sellerA.storeId, "confirmed");
    h.client = buyer.client;
    expect(await cancelOrder({ orderId })).toEqual({ ok: false, reason: "not_cancellable" });
    const { data: after } = await svc().from("orders").select("status").eq("id", orderId).single();
    expect(after?.status).toBe("confirmed");
  });

  it("cancelOrder / acceptOrder: a foreign order → not_found (ownership pin)", async () => {
    const orderId = await seedOrder("cforeign", buyer.id, sellerA.storeId, "pending");
    h.client = buyer2.client; // not the buyer
    expect(await cancelOrder({ orderId })).toEqual({ ok: false, reason: "not_found" });
    h.client = sellerB.client; // not the store
    expect(await acceptOrder({ orderId })).toEqual({ ok: false, reason: "not_found" });
  });

  // ═══ createOrderFromInquiry action — branches that create NO order ═════════
  it("createOrderFromInquiry: phone-NULL buyer → phone_required (OD-4)", async () => {
    h.client = phoneNull.client;
    const inqId = await seedConfirmedInquiry(phoneNull.id, sellerA.storeId, listingA);
    const res = await createOrderFromInquiry({
      inquiryId: inqId,
      addressId: randomUUID(),
      deliveryMethod: "delivery",
      depositMethod: "instapay",
    });
    expect(res).toEqual({ ok: false, reason: "phone_required" });
  });

  it("createOrderFromInquiry: an OPEN (non-confirmed) inquiry → not_confirmed, NO order", async () => {
    const { data: inq } = await svc()
      .from("inquiries")
      .insert({
        buyer_id: buyer.id,
        store_id: sellerA.storeId,
        listing_id: listingA,
        buyer_first_message: `open ${RUN}`,
        status: "open",
      })
      .select("id")
      .single();
    h.client = buyer.client;
    const res = await createOrderFromInquiry({
      inquiryId: inq!.id,
      addressId: randomUUID(),
      deliveryMethod: "delivery",
      depositMethod: "instapay",
    });
    expect(res).toEqual({ ok: false, reason: "not_confirmed" });
    const { count } = await svc().from("orders").select("id", { count: "exact", head: true }).eq("inquiry_id", inq!.id);
    expect(count ?? 0).toBe(0);
  });

  it("payment_config_missing: all 3 BETK handles empty → typed outcome AND NO order is created", async () => {
    // STEP-4 finding: staging seeds all three handles as '' → hasAnyDepositHandle=false.
    const inqId = await seedConfirmedInquiry(buyer.id, sellerA.storeId, listingA);
    const { data: addr } = await svc().from("addresses").select("id").eq("buyer_id", buyer.id).limit(1).single();

    h.client = buyer.client;
    const res = await createOrderFromInquiry({
      inquiryId: inqId,
      addressId: addr!.id,
      deliveryMethod: "delivery",
      depositMethod: "instapay",
    });
    expect(res).toEqual({ ok: false, reason: "payment_config_missing" });

    const { count } = await svc().from("orders").select("id", { count: "exact", head: true }).eq("inquiry_id", inqId);
    expect(count ?? 0).toBe(0);
    const { data: inq } = await svc().from("inquiries").select("converted_to_order_id").eq("id", inqId).single();
    expect(inq?.converted_to_order_id).toBeNull();
  });

  // ═══ OPT-IN: rpc atomicity + action transitions (write UNDELETABLE history) ═
  it.runIf(RUN_ORDER_RESIDUE)(
    "[residue] create_order_from_inquiry rpc: 1 order + 1 item + 2 payments + commission + betk_ref + link (atomic)",
    async () => {
      // Set a deposit handle so the ACTION passes payment_config_missing, then restore.
      const { data: prev } = await svc().from("admin_settings").select("value").eq("key", "betk_instapay_handle").single();
      await svc().from("admin_settings").update({ value: "betk@instapay" }).eq("key", "betk_instapay_handle");
      try {
        const inqId = await seedConfirmedInquiry(buyer.id, sellerA.storeId, listingA);
        const { data: addr } = await svc().from("addresses").select("id").eq("buyer_id", buyer.id).limit(1).single();

        h.client = buyer.client;
        const res = await createOrderFromInquiry({
          inquiryId: inqId,
          addressId: addr!.id,
          deliveryMethod: "delivery",
          depositMethod: "instapay",
        });
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const orderId = res.orderId;

        const { data: order } = await svc()
          .from("orders")
          .select("betk_ref, subtotal, total_amount, status, commission_rate, commission_amount")
          .eq("id", orderId)
          .single();
        expect(order?.status).toBe("pending");
        expect(order?.betk_ref).toMatch(/^BETK-\d{8}-[0-9A-F]{4}$/);
        expect(Number(order?.subtotal)).toBe(100); // price 100 × qty 1

        const { data: pays } = await svc().from("payments").select("payment_type, method, status, amount").eq("order_id", orderId);
        expect(pays?.length).toBe(2);
        const dep = pays?.find((p) => p.payment_type === "deposit");
        const bal = pays?.find((p) => p.payment_type === "balance");
        expect(dep?.method).toBe("instapay");
        expect(dep?.status).toBe("pending");
        expect(bal?.method).toBe("cod");
        expect(Number(dep?.amount)! + Number(bal?.amount)!).toBe(Number(order?.total_amount));

        const { data: items } = await svc().from("order_items").select("id").eq("order_id", orderId);
        expect(items?.length).toBe(1);

        const { data: inq } = await svc().from("inquiries").select("converted_to_order_id").eq("id", inqId).single();
        expect(inq?.converted_to_order_id).toBe(orderId);

        // Idempotent: a 2nd rpc on the same inquiry is rejected (already converted).
        const again = await createOrderFromInquiry({
          inquiryId: inqId,
          addressId: addr!.id,
          deliveryMethod: "delivery",
          depositMethod: "instapay",
        });
        expect(again.ok).toBe(false);
        if (!again.ok) expect(again.reason).toBe("already_converted");
      } finally {
        await svc().from("admin_settings").update({ value: prev?.value ?? "" }).eq("key", "betk_instapay_handle");
      }
    },
  );

  it.runIf(RUN_ORDER_RESIDUE)(
    "[residue] cancelOrder action (buyer, pending): status→cancelled, cancelled_by server-stamped, history written",
    async () => {
      const orderId = await seedOrder("acancel", buyer.id, sellerA.storeId, "pending");
      h.client = buyer.client;
      expect(await cancelOrder({ orderId })).toEqual({ ok: true });
      const { data: after } = await svc().from("orders").select("status, cancelled_by").eq("id", orderId).single();
      expect(after?.status).toBe("cancelled");
      expect(after?.cancelled_by).toBe("buyer"); // stamped by the trigger, never by the client
    },
  );

  it.runIf(RUN_ORDER_RESIDUE)(
    "[residue] acceptOrder action (seller, deposit confirmed): pending→confirmed, confirmed_at stamped, history written",
    async () => {
      const orderId = await seedOrder("aaccept", buyer.id, sellerA.storeId, "pending");
      await seedPayment(orderId, "deposit", "confirmed");
      h.client = sellerA.client;
      expect(await acceptOrder({ orderId })).toEqual({ ok: true, alreadyConfirmed: false });
      const { data: after } = await svc().from("orders").select("status, confirmed_at").eq("id", orderId).single();
      expect(after?.status).toBe("confirmed");
      expect(after?.confirmed_at).not.toBeNull(); // trigger-stamped (ungranted column)
    },
  );
});
