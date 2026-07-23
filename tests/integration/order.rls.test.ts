/**
 * Phase 07 / T01 — order-set RLS integration tests (REG-09 + REG-48).
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg). Mints real
 * GoTrue users, exercises the policies through RLS-respecting authenticated
 * clients (service-role only seeds + tears down), and cleans every fixture.
 *
 * Migration 20260723074953_order_rls_and_conversion_link, ERD §3 rows 53-59:
 *   orders               — permissive orders_insert (WITH CHECK buyer_id=auth.uid())
 *                          COMBINES with the RESTRICTIVE orders_phone_gate (OD-4).
 *   order_items          — SELECT follows order (buyer/store/admin); INSERT=buyer-of-parent.
 *   order_status_history — SELECT follows order; INSERT=any party; UPDATE/DELETE blocked
 *                          by the append-only RULES (no policy).
 *   order_messages       — SELECT/INSERT=order parties; INSERT pins sender_id=auth.uid().
 *   shipments /
 *   shipment_tracking_events — SELECT=parties (READ landed now; store/courier WRITE = Phase 08).
 *   + the converted_to_order_id DEFINER trigger (THE TENSION, option a).
 *
 * Proves:
 *   REG-09  (+)  phone-verified buyer INSERTs OWN order                       (PASS)
 *   REG-09  (-)  phone-NULL user DENIED (the gate finally bites)              (DENY)
 *   REG-09  (-)  cross-user buyer_id DENIED (ownership WITH CHECK)            (DENY)
 *   CHILDREN(+)  buyer + owning seller read order/items/messages/shipments   (PASS)
 *   CHILDREN(-)  outsider seller + outsider buyer + anon → zero rows         (DENY)
 *   ITEMS   (+/-) buyer INSERTs own order's item; outsider/seller/anon denied (PASS/DENY)
 *   MSGS    (+/-) both parties send (pinned sender); spoofed/outsider denied  (PASS/DENY)
 *   SHIP    (-)  parties can READ; party WRITE denied (deferred to Phase 08)  (PASS/DENY)
 *   HISTORY (-)  outsider INSERT denied (append-only positive = opt-in)       (DENY)
 *   TENSION (+)  order-from-inquiry sets inquiries.converted_to_order_id      (PASS)
 *   TENSION (+)  a 2nd order for the same inquiry does NOT overwrite it       (PASS)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

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

// The order_status_history positive INSERT + append-only proof leaves permanent
// residue: the table's `no_update/no_delete_order_history` DO INSTEAD NOTHING
// rules make its rows undeletable via the Data API (even by service-role), and
// its order_id FK has no ON DELETE CASCADE, so a seeded history row also blocks
// its parent order's teardown. OFF by default to keep runs zero-residue (mirrors
// the rls.smoke A5 precedent); the outsider-INSERT denial below always runs.
const RUN_APPEND_ONLY = process.env.RLS_TEST_APPEND_ONLY === "1";

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P7T01_${RUN}!`;
const EMAIL_PREFIX = "betk-p7t01-";
const REF_PREFIX = `P7T01-${RUN}`;

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];

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

interface Buyer {
  id: string;
  email: string;
  client: BetkClient;
}

async function createBuyer(label: string, phone: string | null): Promise<Buyer> {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: phone, auth_provider: phone ? "phone" : "google", role: "buyer" });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  return { id, email, client: await signIn(email) };
}

interface Seller {
  id: string;
  email: string;
  client: BetkClient;
  storeId: string;
}

async function createSeller(label: string): Promise<Seller> {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "seller" });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  const { error: spErr } = await svc().from("seller_profiles").insert({ id, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed(${label}) failed: ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: id,
      name_ar: `متجر ${label} ${RUN}`,
      slug: `p7t01-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}) failed: ${stErr?.message}`);

  return { id, email, client: await signIn(email), storeId: store.id };
}

/** FK-safe teardown of every order owned by the given buyers/stores + residue sweep. */
async function purgeByUserIds(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const db = svc();

  const { data: stores } = await db.from("stores").select("id").in("seller_id", userIds);
  const storeIds = (stores ?? []).map((s) => s.id);

  const orderIdSet = new Set<string>();
  const { data: ob } = await db.from("orders").select("id").in("buyer_id", userIds);
  for (const o of ob ?? []) orderIdSet.add(o.id);
  if (storeIds.length) {
    const { data: os } = await db.from("orders").select("id").in("store_id", storeIds);
    for (const o of os ?? []) orderIdSet.add(o.id);
  }
  const orderIds = [...orderIdSet];

  if (orderIds.length) {
    // Break the inquiries<->orders circular FK before deleting orders.
    await db.from("inquiries").update({ converted_to_order_id: null }).in("converted_to_order_id", orderIds);
    await db.from("shipments").delete().in("order_id", orderIds); // cascades tracking events
    await db.from("order_items").delete().in("order_id", orderIds);
    await db.from("order_messages").delete().in("order_id", orderIds);
    await db.from("payments").delete().in("order_id", orderIds);
    // order_status_history is append-only + un-cascaded; a delete no-ops (opt-in
    // residue only). Best-effort: it never throws, just leaves that one order.
    await db.from("orders").delete().in("id", orderIds);
  }

  await db.from("inquiries").delete().in("buyer_id", userIds);
  if (storeIds.length) {
    await db.from("inquiries").delete().in("store_id", storeIds);
    await db.from("listings").delete().in("store_id", storeIds);
    await db.from("stores").delete().in("id", storeIds);
  }
  await db.from("seller_profiles").delete().in("id", userIds);
  await db.from("users").delete().in("id", userIds);
  for (const id of userIds) {
    await service.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

/** Sweep leftover auth users (+ fixtures) from prior crashed runs, by email prefix. */
async function sweepLeftovers(): Promise<void> {
  const leftover: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users.length) break;
    for (const u of data.users) {
      if (u.email?.startsWith(EMAIL_PREFIX)) leftover.push(u.id);
    }
    if (data.users.length < 200) break;
  }
  await purgeByUserIds(leftover);
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 07 / T01 — order-set RLS (staging)", () => {
  let sellerA: Seller; // owns the store the order targets
  let sellerB: Seller; // unrelated seller (outsider)
  let buyer: Buyer; // the order buyer (phone-verified)
  let outsiderBuyer: Buyer; // unrelated buyer (phone-verified)
  let googleNoPhone: Buyer; // OAuth buyer, phone NULL (phone-gate DENY)
  let listingA: string;
  let confirmedInquiryId: string; // buyer -> storeA, for the tension proof

  let orderId = ""; // buyer's main order (no inquiry) — children fixture
  let shipmentId = "";

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    await sweepLeftovers();

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category for fixtures: ${catErr?.message}`);
    const categoryId = cat.id;

    sellerA = await createSeller("sellera");
    sellerB = await createSeller("sellerb");
    buyer = await createBuyer("buyer", makePhone());
    outsiderBuyer = await createBuyer("outsider", makePhone());
    googleNoPhone = await createBuyer("nophone", null);

    const { data: listing, error: lErr } = await svc()
      .from("listings")
      .insert({
        store_id: sellerA.storeId,
        category_id: categoryId,
        type: "product",
        title_ar: `منتج اختبار ${RUN}`,
        price: 100,
        price_type: "fixed",
        status: "active",
      })
      .select("id")
      .single();
    if (lErr || !listing) throw new Error(`listings seed failed: ${lErr?.message}`);
    listingA = listing.id;

    // A confirmed inquiry (buyer -> storeA) for the converted_to_order_id proof.
    const { data: inq, error: iErr } = await svc()
      .from("inquiries")
      .insert({
        buyer_id: buyer.id,
        store_id: sellerA.storeId,
        listing_id: listingA,
        buyer_first_message: `checkout me ${RUN}`,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (iErr || !inq) throw new Error(`inquiry seed failed: ${iErr?.message}`);
    confirmedInquiryId = inq.id;
  });

  afterAll(async () => {
    await purgeByUserIds(createdAuthIds);
  });

  function orderPayload(ref: string, buyerId: string, inquiryId?: string) {
    return {
      betk_ref: `${REF_PREFIX}-${ref}`,
      buyer_id: buyerId,
      store_id: sellerA.storeId,
      inquiry_id: inquiryId ?? null,
      delivery_method: "delivery" as const,
      subtotal: 100,
      delivery_fee: 0,
      total_amount: 100,
      status: "pending" as const,
    };
  }

  // -------------------------------------------------------------------------
  // REG-09 — orders permissive INSERT (both halves) + ownership
  // -------------------------------------------------------------------------
  it("REG-09 (+): phone-verified buyer INSERTs OWN order (orders_insert + phone gate COMBINE)", async () => {
    const ins = await buyer.client
      .from("orders")
      .insert(orderPayload("main", buyer.id))
      .select("id, status")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.id).toBeTruthy();
    expect(ins.data?.status).toBe("pending");
    orderId = ins.data!.id;
  });

  it("REG-09 (-): phone-NULL user DENIED (the RESTRICTIVE gate finally bites)", async () => {
    const ins = await googleNoPhone.client
      .from("orders")
      .insert(orderPayload("nophone", googleNoPhone.id))
      .select("id");
    expect(ins.error).not.toBeNull();
    expect(ins.data?.length ?? 0).toBe(0);
  });

  it("REG-09 (-): cross-user buyer_id DENIED (ownership WITH CHECK)", async () => {
    const ins = await buyer.client
      .from("orders")
      .insert(orderPayload("spoof", outsiderBuyer.id)) // not the caller
      .select("id");
    expect(ins.error).not.toBeNull();
    expect(ins.data?.length ?? 0).toBe(0);
  });

  it("ORDERS READ: buyer + owning seller read; outsider seller/buyer + anon → 0", async () => {
    const byBuyer = await buyer.client.from("orders").select("id").eq("id", orderId);
    expect(byBuyer.data?.length ?? 0).toBe(1);

    const bySellerA = await sellerA.client.from("orders").select("id").eq("id", orderId);
    expect(bySellerA.data?.length ?? 0).toBe(1);

    const bySellerB = await sellerB.client.from("orders").select("id").eq("id", orderId);
    expect(bySellerB.data?.length ?? 0).toBe(0);

    const byOutsider = await outsiderBuyer.client.from("orders").select("id").eq("id", orderId);
    expect(byOutsider.data?.length ?? 0).toBe(0);

    const byAnon = await anonClient().from("orders").select("id").eq("id", orderId);
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // REG-48 — order_items: buyer-of-parent INSERT, parties READ
  // -------------------------------------------------------------------------
  it("ITEMS (+): buyer INSERTs an item into OWN order (order_items_insert = buyer-of-parent)", async () => {
    const ins = await buyer.client
      .from("order_items")
      .insert({
        order_id: orderId,
        listing_id: listingA,
        listing_title_ar: `منتج ${RUN}`,
        quantity: 1,
        unit_price: 100,
        subtotal: 100,
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.id).toBeTruthy();
  });

  it("ITEMS (-): outsider buyer, owning seller, and anon CANNOT INSERT items into the order", async () => {
    const item = {
      order_id: orderId,
      listing_id: listingA,
      listing_title_ar: `evil ${RUN}`,
      quantity: 1,
      unit_price: 100,
      subtotal: 100,
    };
    const byOutsider = await outsiderBuyer.client.from("order_items").insert(item).select("id");
    expect(byOutsider.error).not.toBeNull();
    expect(byOutsider.data?.length ?? 0).toBe(0);

    // The owning seller can READ items but the INSERT path is buyer-of-parent only.
    const bySeller = await sellerA.client.from("order_items").insert(item).select("id");
    expect(bySeller.error).not.toBeNull();
    expect(bySeller.data?.length ?? 0).toBe(0);

    const byAnon = await anonClient().from("order_items").insert(item).select("id");
    expect(byAnon.error).not.toBeNull();
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  it("ITEMS READ: buyer + owning seller see the item; outsider seller/buyer + anon → 0", async () => {
    const byBuyer = await buyer.client.from("order_items").select("id").eq("order_id", orderId);
    expect(byBuyer.data?.length ?? 0).toBe(1);

    const bySellerA = await sellerA.client.from("order_items").select("id").eq("order_id", orderId);
    expect(bySellerA.data?.length ?? 0).toBe(1);

    const bySellerB = await sellerB.client.from("order_items").select("id").eq("order_id", orderId);
    expect(bySellerB.data?.length ?? 0).toBe(0);

    const byOutsider = await outsiderBuyer.client
      .from("order_items")
      .select("id")
      .eq("order_id", orderId);
    expect(byOutsider.data?.length ?? 0).toBe(0);

    const byAnon = await anonClient().from("order_items").select("id").eq("order_id", orderId);
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // REG-48 — order_messages: order-thread parties send (pinned sender) + read
  // -------------------------------------------------------------------------
  it("MSGS (+): both order parties INSERT messages (sender pinned) and both read the thread", async () => {
    const buyerMsg = await buyer.client
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: buyer.id, sender_type: "buyer", body: `buyer ${RUN}` })
      .select("id")
      .single();
    expect(buyerMsg.error).toBeNull();
    expect(buyerMsg.data?.id).toBeTruthy();

    const sellerMsg = await sellerA.client
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: sellerA.id, sender_type: "seller", body: `seller ${RUN}` })
      .select("id")
      .single();
    expect(sellerMsg.error).toBeNull();
    expect(sellerMsg.data?.id).toBeTruthy();

    const buyerRead = await buyer.client.from("order_messages").select("id").eq("order_id", orderId);
    expect(buyerRead.data?.length ?? 0).toBe(2);
    const sellerRead = await sellerA.client.from("order_messages").select("id").eq("order_id", orderId);
    expect(sellerRead.data?.length ?? 0).toBe(2);
  });

  it("MSGS (-): spoofed sender_id, outsider, and anon INSERT are all DENIED", async () => {
    // Buyer is a party but pins the WRONG sender_id (spoof the seller) → denied.
    const spoof = await buyer.client
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: sellerA.id, sender_type: "seller", body: "spoof" })
      .select("id");
    expect(spoof.error).not.toBeNull();
    expect(spoof.data?.length ?? 0).toBe(0);

    const byOutsider = await outsiderBuyer.client
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: outsiderBuyer.id, sender_type: "buyer", body: "evil" })
      .select("id");
    expect(byOutsider.error).not.toBeNull();
    expect(byOutsider.data?.length ?? 0).toBe(0);

    const byAnon = await anonClient()
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: buyer.id, sender_type: "buyer", body: "evil" })
      .select("id");
    expect(byAnon.error).not.toBeNull();
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  it("MSGS READ: outsider seller/buyer + anon see zero thread messages", async () => {
    const bySellerB = await sellerB.client.from("order_messages").select("id").eq("order_id", orderId);
    expect(bySellerB.data?.length ?? 0).toBe(0);
    const byOutsider = await outsiderBuyer.client
      .from("order_messages")
      .select("id")
      .eq("order_id", orderId);
    expect(byOutsider.data?.length ?? 0).toBe(0);
    const byAnon = await anonClient().from("order_messages").select("id").eq("order_id", orderId);
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // REG-48 — shipments / shipment_tracking_events: READ now, WRITE = Phase 08
  // -------------------------------------------------------------------------
  it("SHIP READ: parties read the shipment + tracking event; outsider/anon → 0", async () => {
    // Seeded via service-role (no party WRITE policy in Phase 07).
    const { data: ship, error: sErr } = await svc()
      .from("shipments")
      .insert({ order_id: orderId, courier: "Bosta", status: "created" })
      .select("id")
      .single();
    if (sErr || !ship) throw new Error(`shipment seed failed: ${sErr?.message}`);
    shipmentId = ship.id;

    const { error: teErr } = await svc().from("shipment_tracking_events").insert({
      shipment_id: shipmentId,
      status: "created",
      description: `packed ${RUN}`,
      event_at: new Date().toISOString(),
    });
    if (teErr) throw new Error(`tracking event seed failed: ${teErr.message}`);

    const buyerShip = await buyer.client.from("shipments").select("id").eq("id", shipmentId);
    expect(buyerShip.data?.length ?? 0).toBe(1);
    const sellerShip = await sellerA.client.from("shipments").select("id").eq("id", shipmentId);
    expect(sellerShip.data?.length ?? 0).toBe(1);
    const outsiderShip = await outsiderBuyer.client.from("shipments").select("id").eq("id", shipmentId);
    expect(outsiderShip.data?.length ?? 0).toBe(0);
    const anonShip = await anonClient().from("shipments").select("id").eq("id", shipmentId);
    expect(anonShip.data?.length ?? 0).toBe(0);

    const buyerTe = await buyer.client
      .from("shipment_tracking_events")
      .select("id")
      .eq("shipment_id", shipmentId);
    expect(buyerTe.data?.length ?? 0).toBe(1);
    const sellerTe = await sellerA.client
      .from("shipment_tracking_events")
      .select("id")
      .eq("shipment_id", shipmentId);
    expect(sellerTe.data?.length ?? 0).toBe(1);
    const outsiderTe = await outsiderBuyer.client
      .from("shipment_tracking_events")
      .select("id")
      .eq("shipment_id", shipmentId);
    expect(outsiderTe.data?.length ?? 0).toBe(0);
    const anonTe = await anonClient()
      .from("shipment_tracking_events")
      .select("id")
      .eq("shipment_id", shipmentId);
    expect(anonTe.data?.length ?? 0).toBe(0);
  });

  it("SHIP WRITE (-): a party CANNOT INSERT a shipment (store/courier WRITE deferred to Phase 08)", async () => {
    const bySeller = await sellerA.client
      .from("shipments")
      .insert({ order_id: orderId, courier: "Bosta", status: "created" })
      .select("id");
    expect(bySeller.error).not.toBeNull();
    expect(bySeller.data?.length ?? 0).toBe(0);

    const byBuyer = await buyer.client
      .from("shipments")
      .insert({ order_id: orderId, courier: "Bosta", status: "created" })
      .select("id");
    expect(byBuyer.error).not.toBeNull();
    expect(byBuyer.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // REG-48 — order_status_history: outsider INSERT denied (append-only = opt-in)
  // -------------------------------------------------------------------------
  it("HISTORY (-): outsider buyer + anon CANNOT INSERT a status-history row", async () => {
    const row = {
      order_id: orderId,
      to_status: "confirmed" as const,
      changed_by_type: "buyer" as const,
    };
    const byOutsider = await outsiderBuyer.client
      .from("order_status_history")
      .insert(row)
      .select("id");
    expect(byOutsider.error).not.toBeNull();
    expect(byOutsider.data?.length ?? 0).toBe(0);

    const byAnon = await anonClient().from("order_status_history").insert(row).select("id");
    expect(byAnon.error).not.toBeNull();
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  it.runIf(RUN_APPEND_ONLY)(
    "HISTORY (opt-in): party INSERTs + reads; UPDATE/DELETE are append-only no-ops",
    async () => {
      const ins = await buyer.client
        .from("order_status_history")
        .insert({
          order_id: orderId,
          to_status: "cancelled",
          changed_by: buyer.id,
          changed_by_type: "buyer",
          notes: `append-only ${RUN}`,
        })
        .select("id")
        .single();
      expect(ins.error).toBeNull();
      const histId = ins.data!.id;

      const byBuyer = await buyer.client.from("order_status_history").select("id").eq("id", histId);
      expect(byBuyer.data?.length ?? 0).toBe(1);
      const bySeller = await sellerA.client.from("order_status_history").select("id").eq("id", histId);
      expect(bySeller.data?.length ?? 0).toBe(1);
      const byOutsider = await outsiderBuyer.client
        .from("order_status_history")
        .select("id")
        .eq("id", histId);
      expect(byOutsider.data?.length ?? 0).toBe(0);

      // Append-only RULES (DO INSTEAD NOTHING) rewrite UPDATE/DELETE to no-ops.
      const upd = await buyer.client
        .from("order_status_history")
        .update({ notes: "HACKED" })
        .eq("id", histId)
        .select("id");
      expect(upd.data?.length ?? 0).toBe(0);
      const del = await buyer.client
        .from("order_status_history")
        .delete()
        .eq("id", histId)
        .select("id");
      expect(del.data?.length ?? 0).toBe(0);

      const { data: after } = await svc()
        .from("order_status_history")
        .select("notes")
        .eq("id", histId)
        .single();
      expect(after?.notes).toBe(`append-only ${RUN}`); // survived unchanged
    },
  );

  // -------------------------------------------------------------------------
  // THE TENSION — converted_to_order_id DEFINER trigger (option a)
  // -------------------------------------------------------------------------
  it("TENSION (+): order-from-inquiry sets inquiries.converted_to_order_id via the DEFINER trigger", async () => {
    const ins = await buyer.client
      .from("orders")
      .insert(orderPayload("conv", buyer.id, confirmedInquiryId))
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const convOrderId = ins.data!.id;

    // The buyer has NO inquiries UPDATE right — the linkage is written by the
    // SECURITY DEFINER AFTER INSERT trigger, not the buyer's session.
    const { data: inq } = await svc()
      .from("inquiries")
      .select("converted_to_order_id")
      .eq("id", confirmedInquiryId)
      .single();
    expect(inq?.converted_to_order_id).toBe(convOrderId);

    // And the buyer genuinely cannot write that column directly (RLS proof).
    const direct = await buyer.client
      .from("inquiries")
      .update({ status: "confirmed" })
      .eq("id", confirmedInquiryId)
      .select("id");
    expect(direct.data?.length ?? 0).toBe(0);
  });

  it("TENSION (+): a 2nd order for the same inquiry does NOT overwrite the link (first wins)", async () => {
    const { data: before } = await svc()
      .from("inquiries")
      .select("converted_to_order_id")
      .eq("id", confirmedInquiryId)
      .single();
    const firstLink = before?.converted_to_order_id;
    expect(firstLink).toBeTruthy();

    const ins = await buyer.client
      .from("orders")
      .insert(orderPayload("conv2", buyer.id, confirmedInquiryId))
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    const { data: after } = await svc()
      .from("inquiries")
      .select("converted_to_order_id")
      .eq("id", confirmedInquiryId)
      .single();
    expect(after?.converted_to_order_id).toBe(firstLink); // unchanged — IS NULL guard
  });
});
