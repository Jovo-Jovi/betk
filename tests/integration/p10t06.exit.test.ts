/**
 * P10 T06 — cart page read and exit gaps, against staging under RLS.
 *
 * Does not call checkout_from_cart. Does not write payment_window_minutes.
 * Deletes only rows this run inserted. This file does not insert
 * order_status_history. A committed history row cannot be deleted
 * (no_delete_order_history), and leaving one fails Guard G.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { goodsSubtotal } from "@/features/cart/cartRules";
import { computeAvgResponseHours } from "@/features/messaging/messagingRules";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { getCartPage } from "@/features/cart/queries/getCartPage";
import { removeCartItem } from "@/features/cart/actions/removeCartItem";
import { addToCart } from "@/features/discovery/actions/addToCart";
import { setCartItemQuantity } from "@/features/discovery/actions/setCartItemQuantity";
import { createInquiry } from "@/features/messaging/actions/createInquiry";
import { sendInquiryQuote } from "@/features/messaging/actions/sendInquiryQuote";
import { acceptInquiryQuote } from "@/features/messaging/actions/acceptInquiryQuote";
import { sendInquiryMessage } from "@/features/messaging/actions/sendInquiryMessage";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type BetkClient = SupabaseClient<Database, "betk">;
type Actor = { id: string; client: BetkClient };

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P10T06_${RUN}!`;
const EMAIL_PREFIX = "betk-p10t06-";
const ORDER_PREFIX = "P10T06-";
const LISTING_PRICE = 100;
const FALLBACKS = { listing: "Listing", store: "Store" };

const service = createServiceClient();
const svc = () => service.schema("betk");

const createdAuthIds: string[] = [];
const orderIds: string[] = [];
const masterIds: string[] = [];
let seller!: Actor & { storeId: string };
let buyer!: Actor;
let categoryId = "";
let madeToOrderId = "";
let fixedId = "";
let multiplier = 0;

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
  return `+2015${n.toString().padStart(8, "0")}`;
}

async function signIn(email: string): Promise<BetkClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

function money(value: number | string | null): number {
  return Number(value);
}

function permissionDenied(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return /42501|permission denied/i.test(`${error.code ?? ""} ${error.message ?? ""}`);
}

async function settingRaw(key: string): Promise<string> {
  const { data, error } = await svc().from("admin_settings").select("value").eq("key", key).single();
  if (error || data?.value == null) throw new Error(`${key}: ${error?.message ?? "missing"}`);
  return data.value;
}

async function settingNumber(key: string): Promise<number> {
  const value = Number(await settingRaw(key));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} is not a positive number`);
  return value;
}

async function historyCount(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { count, error } = await svc()
    .from("order_status_history")
    .select("id", { count: "exact", head: true })
    .in("order_id", ids);
  if (error) throw new Error(`history count: ${error.message}`);
  return count ?? 0;
}

async function refuseLeftoverHistory(ids: string[]): Promise<void> {
  const left = await historyCount(ids);
  if (left > 0) {
    throw new Error(
      `STOP: ${left} order_status_history row(s) remain on seller orders ${ids.join(", ")}. Delete did not remove them. Do not widen Guard G.`,
    );
  }
}

async function createBuyer(label: string): Promise<Actor> {
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
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "buyer" });
  if (uErr) throw new Error(`users seed(${label}): ${uErr.message}`);

  const version = await settingRaw("agreement_buyer_terms_version");
  const { error: acceptErr } = await svc().from("agreement_acceptances").insert({
    user_id: id,
    document: "buyer_terms",
    version_label: version,
  });
  if (acceptErr) throw new Error(`buyer terms seed(${label}): ${acceptErr.message}`);
  return { id, client: await signIn(email) };
}

async function createSeller(label: string): Promise<Actor & { storeId: string }> {
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
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "seller" });
  if (uErr) throw new Error(`users seed(${label}): ${uErr.message}`);

  const { error: spErr } = await svc().from("seller_profiles").insert({ id, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed(${label}): ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: id,
      name_ar: `P10T06 ${label} ${RUN}`,
      slug: `p10t06-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}): ${stErr?.message}`);
  return { id, client: await signIn(email), storeId: store.id };
}

async function seedListing(fields: {
  isMadeToOrder: boolean;
  stockQty: number | null;
  price?: number;
}): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: seller.storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `P10T06 ${fields.isMadeToOrder ? "mto" : "fixed"} ${RUN}`,
      price: fields.price ?? LISTING_PRICE,
      price_type: "fixed",
      status: "active",
      prep_days: 1,
      weight_g: 1,
      length_mm: 1,
      width_mm: 1,
      height_mm: 1,
      is_made_to_order: fields.isMadeToOrder,
      stock_qty: fields.stockQty,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`listings seed failed: ${error?.message}`);
  return data.id;
}

async function setStoreStatus(status: "active" | "suspended"): Promise<void> {
  const { error } = await svc().from("stores").update({ status }).eq("id", seller.storeId);
  if (error) throw new Error(`store status: ${error.message}`);
}

async function stockOf(listingId: string): Promise<number | null> {
  const { data, error } = await svc().from("listings").select("stock_qty, status").eq("id", listingId).single();
  if (error || !data) throw new Error(error?.message ?? "listing");
  return data.stock_qty == null ? null : Number(data.stock_qty);
}

async function clearCart(): Promise<void> {
  const { error } = await svc().from("cart_items").delete().eq("buyer_id", buyer.id);
  if (error) throw new Error(`clear cart: ${error.message}`);
}

async function fixedCartLine(listingId: string) {
  const { data, error } = await svc()
    .from("cart_items")
    .select("id, quantity, unit_price, is_custom, inquiry_id")
    .eq("buyer_id", buyer.id)
    .eq("listing_id", listingId)
    .is("inquiry_id", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function customCartLine(inquiryId: string) {
  const { data, error } = await svc()
    .from("cart_items")
    .select("id, quantity, unit_price, is_custom, inquiry_id")
    .eq("inquiry_id", inquiryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function buyerPage() {
  h.client = buyer.client;
  const page = await getCartPage("en", FALLBACKS);
  if (!page.ok) throw new Error("getCartPage returned ok:false");
  return page;
}

async function openInquiry(listingId: string, label: string): Promise<string> {
  h.client = buyer.client;
  const opened = await createInquiry({ listingId, message: `${label} ${RUN}` });
  if (!opened.ok) throw new Error(`createInquiry ${label}: ${opened.reason}`);
  return opened.inquiryId;
}

async function quoteInquiry(inquiryId: string, price: number, prepDays = 1): Promise<void> {
  h.client = seller.client;
  const result = await sendInquiryQuote({ inquiryId, quotedPrice: price, prepDays });
  if (!result.ok) throw new Error(`quote: ${result.messageKey}`);
}

async function seedQuotedInquiry(listingId: string, expiresAt: string, price: number): Promise<string> {
  const { data, error } = await svc()
    .from("inquiries")
    .insert({
      buyer_id: buyer.id,
      store_id: seller.storeId,
      listing_id: listingId,
      buyer_first_message: `p10t06 ${RUN}`,
      status: "replied",
      quoted_price: price,
      quoted_prep_days: 1,
      quoted_at: new Date().toISOString(),
      quote_expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "inquiry seed");
  return data.id;
}

async function seedOrder(
  label: string,
  status: "pending",
  items: { listingId: string; quantity: number; unitPrice: number; inquiryId: string | null }[],
): Promise<string> {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const ref = `${ORDER_PREFIX}${label}-${RUN}`;
  if (`${ref}-M`.length > 25) throw new Error(`betk_ref too long: ${ref}-M`);
  const { data: master, error: masterErr } = await svc()
    .from("master_orders")
    .insert({
      buyer_id: buyer.id,
      betk_ref: `${ref}-M`,
      combined_delivery_total: 0,
      payment_deadline: new Date(Date.now() - 60_000).toISOString(),
      proof_path: null,
    })
    .select("id")
    .single();
  if (masterErr || !master) throw new Error(`master ${label}: ${masterErr?.message}`);
  masterIds.push(master.id);

  const { data: order, error } = await svc()
    .from("seller_orders")
    .insert({
      betk_ref: ref,
      buyer_id: buyer.id,
      store_id: seller.storeId,
      delivery_method: "delivery",
      subtotal,
      delivery_fee: 0,
      total_amount: subtotal,
      status,
      master_order_id: master.id,
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(`order ${label}: ${error?.message}`);
  orderIds.push(order.id);

  const { error: itemErr } = await svc()
    .from("order_items")
    .insert(
      items.map((item) => ({
        order_id: order.id,
        listing_id: item.listingId,
        listing_title_ar: `P10T06 ${label}`,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        is_custom: item.inquiryId != null,
        inquiry_id: item.inquiryId,
      })),
    );
  if (itemErr) throw new Error(`order_items ${label}: ${itemErr.message}`);
  return order.id;
}

async function cancelBySystem(orderId: string): Promise<{ status: string; cancelled_by: string | null }> {
  const { data, error } = await svc()
    .from("seller_orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .select("status, cancelled_by")
    .single();
  if (error || !data) throw new Error(`cancel: ${error?.message ?? "no row"}`);
  return data;
}

async function quoteRow(inquiryId: string) {
  const { data, error } = await svc()
    .from("inquiries")
    .select("quoted_price, quoted_prep_days, quote_expires_at, status")
    .eq("id", inquiryId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "missing inquiry");
  return data;
}

async function otherInBandPrice(): Promise<number> {
  const min = Number(await settingRaw("price_band_min_egp"));
  const max = Number(await settingRaw("price_band_max_egp"));
  const candidates = [LISTING_PRICE + 1, min, max].filter(
    (price) => price !== LISTING_PRICE && price >= min && price <= max,
  );
  const price = candidates[0];
  if (price == null) throw new Error("no in-band price other than the listing price");
  return price;
}

async function prefixUserIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const listed = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`listUsers: ${listed.error.message}`);
    const users = listed.data?.users ?? [];
    for (const user of users) {
      if (user.email?.startsWith(EMAIL_PREFIX)) ids.push(user.id);
    }
    if (users.length < 200) break;
  }
  return ids;
}

async function storeIdsFor(sellerIds: string[]): Promise<string[]> {
  if (sellerIds.length === 0) return [];
  const { data, error } = await svc().from("stores").select("id").in("seller_id", sellerIds);
  if (error) throw new Error(`stores lookup: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

async function purgeStale(): Promise<void> {
  const { data: staleOrders, error } = await svc()
    .from("seller_orders")
    .select("id, master_order_id")
    .like("betk_ref", `${ORDER_PREFIX}%`);
  if (error) throw new Error(`stale orders: ${error.message}`);
  const staleOrderIds = (staleOrders ?? []).map((row) => row.id);
  await refuseLeftoverHistory(staleOrderIds);
  if (staleOrderIds.length > 0) {
    const { error: itemErr } = await svc().from("order_items").delete().in("order_id", staleOrderIds);
    if (itemErr) throw new Error(`stale items: ${itemErr.message}`);
    const { error: orderErr } = await svc().from("seller_orders").delete().in("id", staleOrderIds);
    if (orderErr) throw new Error(`stale seller orders: ${orderErr.message}`);
    const masters = [...new Set((staleOrders ?? []).map((row) => row.master_order_id))];
    const { error: masterErr } = await svc().from("master_orders").delete().in("id", masters);
    if (masterErr) throw new Error(`stale masters: ${masterErr.message}`);
  }

  const ids = await prefixUserIds();
  if (ids.length > 0) await deleteActors(ids);
}

async function deleteActors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const storeIds = await storeIdsFor(ids);
  const inquiryIds = new Set<string>();
  const { data: byBuyer, error: buyerInqErr } = await svc().from("inquiries").select("id").in("buyer_id", ids);
  if (buyerInqErr) throw new Error(buyerInqErr.message);
  for (const row of byBuyer ?? []) inquiryIds.add(row.id);
  if (storeIds.length > 0) {
    const { data: byStore, error: storeInqErr } = await svc()
      .from("inquiries")
      .select("id")
      .in("store_id", storeIds);
    if (storeInqErr) throw new Error(storeInqErr.message);
    for (const row of byStore ?? []) inquiryIds.add(row.id);
  }
  const allInquiryIds = [...inquiryIds];

  const { error: cartErr } = await svc().from("cart_items").delete().in("buyer_id", ids);
  if (cartErr) throw new Error(`cart delete: ${cartErr.message}`);
  if (allInquiryIds.length > 0) {
    const { error: msgErr } = await svc().from("inquiry_messages").delete().in("inquiry_id", allInquiryIds);
    if (msgErr) throw new Error(`messages delete: ${msgErr.message}`);
    const { error: inquiryDel } = await svc().from("inquiries").delete().in("id", allInquiryIds);
    if (inquiryDel) throw new Error(`inquiries delete: ${inquiryDel.message}`);
  }
  if (storeIds.length > 0) {
    const { error: listErr } = await svc().from("listings").delete().in("store_id", storeIds);
    if (listErr) throw new Error(`listings delete: ${listErr.message}`);
    const { error: scErr } = await svc().from("store_categories").delete().in("store_id", storeIds);
    if (scErr) throw new Error(`store_categories delete: ${scErr.message}`);
    const { error: storeDel } = await svc().from("stores").delete().in("id", storeIds);
    if (storeDel) throw new Error(`stores delete: ${storeDel.message}`);
  }
  const { error: profileErr } = await svc().from("seller_profiles").delete().in("id", ids);
  if (profileErr) throw new Error(`profiles delete: ${profileErr.message}`);
  const { error: acceptErr } = await svc().from("agreement_acceptances").delete().in("user_id", ids);
  if (acceptErr) throw new Error(`acceptances delete: ${acceptErr.message}`);
  const { error: userErr } = await svc().from("users").delete().in("id", ids);
  if (userErr) throw new Error(`users delete: ${userErr.message}`);
  for (const id of ids) {
    const removed = await service.auth.admin.deleteUser(id);
    if (removed.error) throw new Error(`auth delete ${id}: ${removed.error.message}`);
  }
}

async function deleteThisRun(): Promise<void> {
  await refuseLeftoverHistory(orderIds);

  if (orderIds.length > 0) {
    const { error: itemErr } = await svc().from("order_items").delete().in("order_id", orderIds);
    if (itemErr) throw new Error(`order_items delete: ${itemErr.message}`);
    const { error: orderErr } = await svc().from("seller_orders").delete().in("id", orderIds);
    if (orderErr) throw new Error(`seller_orders delete: ${orderErr.message}`);
  }
  if (masterIds.length > 0) {
    const { error: masterErr } = await svc().from("master_orders").delete().in("id", masterIds);
    if (masterErr) throw new Error(`master_orders delete: ${masterErr.message}`);
  }
  await deleteActors(createdAuthIds);
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P10 T06 — cart page and exit evidence", () => {
  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }
    await purgeStale();
    multiplier = await settingNumber("quote_tolerance_multiplier");

    const { data: foodParent, error: foodErr } = await svc()
      .from("categories")
      .select("id")
      .eq("slug", "food-beverages")
      .single();
    if (foodErr || !foodParent) throw new Error(`food parent: ${foodErr?.message}`);
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .neq("slug", "food-beverages")
      .or(`parent_id.is.null,parent_id.neq.${foodParent.id}`)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category: ${catErr?.message}`);
    categoryId = cat.id;

    seller = await createSeller("seller");
    buyer = await createBuyer("buyer");
    const { error: scIns } = await svc()
      .from("store_categories")
      .insert({ store_id: seller.storeId, category_id: categoryId });
    if (scIns) throw new Error(`store_categories insert: ${scIns.message}`);
    const { error: scUpd } = await svc()
      .from("store_categories")
      .update({ approved_at: new Date().toISOString() })
      .eq("store_id", seller.storeId)
      .eq("category_id", categoryId);
    if (scUpd) throw new Error(`store_categories approve: ${scUpd.message}`);

    madeToOrderId = await seedListing({ isMadeToOrder: true, stockQty: null });
    fixedId = await seedListing({ isMadeToOrder: false, stockQty: 5 });
  });

  afterAll(async () => {
    await deleteThisRun();
  });

  it("returns a fixed line at its stored unit price after the listing price changes", async () => {
    await clearCart();
    h.client = buyer.client;
    const added = await addToCart(fixedId, 1);
    expect(added.ok).toBe(true);
    const stored = await fixedCartLine(fixedId);
    expect(stored).not.toBeNull();
    if (!stored) return;
    expect(money(stored.unit_price)).toBe(LISTING_PRICE);
    expect(stored.inquiry_id).toBeNull();
    expect(stored.is_custom).toBe(false);

    const nextPrice = await otherInBandPrice();
    const { error: priceErr } = await svc().from("listings").update({ price: nextPrice }).eq("id", fixedId);
    expect(priceErr).toBeNull();
    try {
      const page = await buyerPage();
      const line = page.lines.find((row) => row.lineId === stored.id);
      expect(line?.unitPrice).toBe(money(stored.unit_price));
      expect(line?.unitPrice).toBe(LISTING_PRICE);
      expect(line?.isCustom).toBe(false);
      expect(line?.inquiryId).toBeNull();
      expect(money((await fixedCartLine(fixedId))!.unit_price)).toBe(LISTING_PRICE);
    } finally {
      const { error } = await svc().from("listings").update({ price: LISTING_PRICE }).eq("id", fixedId);
      if (error) throw new Error(`restore price: ${error.message}`);
    }
  });

  it("blocks an expired custom quote and clears it after remove and a fresh accept", async () => {
    const inquiryId = await openInquiry(madeToOrderId, "expire");
    await quoteInquiry(inquiryId, LISTING_PRICE, 1);
    h.client = buyer.client;
    const accepted = await acceptInquiryQuote({ inquiryId });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const { error: expireErr } = await svc()
      .from("inquiries")
      .update({ quote_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", inquiryId);
    expect(expireErr).toBeNull();

    const blocked = await buyerPage();
    const blockedLine = blocked.lines.find((row) => row.lineId === accepted.cartItemId);
    expect(blockedLine?.blockedReason).toBe("quote_expired");
    expect(blockedLine?.isCustom).toBe(true);

    h.client = seller.client;
    const held = await sendInquiryQuote({
      inquiryId,
      quotedPrice: LISTING_PRICE * multiplier,
      prepDays: 1,
    });
    expect(held.ok).toBe(false);
    if (!held.ok) expect(held.messageKey).toBe("quoteLineHeld");
    expect(money((await quoteRow(inquiryId)).quoted_price)).toBe(LISTING_PRICE);
    expect(await customCartLine(inquiryId)).not.toBeNull();

    h.client = buyer.client;
    const removed = await removeCartItem({ cartItemId: accepted.cartItemId });
    expect(removed.ok).toBe(true);
    expect(await customCartLine(inquiryId)).toBeNull();

    await quoteInquiry(inquiryId, LISTING_PRICE * multiplier, 2);
    h.client = buyer.client;
    const again = await acceptInquiryQuote({ inquiryId });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const cleared = await buyerPage();
    const fresh = cleared.lines.find((row) => row.lineId === again.cartItemId);
    expect(fresh?.blockedReason).toBeNull();
    expect(fresh?.unitPrice).toBe(LISTING_PRICE * multiplier);

    const nextPrice = await otherInBandPrice();
    const { error: priceErr } = await svc().from("listings").update({ price: nextPrice }).eq("id", madeToOrderId);
    expect(priceErr).toBeNull();
    try {
      expect(money((await customCartLine(inquiryId))!.unit_price)).toBe(LISTING_PRICE * multiplier);
    } finally {
      const { error } = await svc().from("listings").update({ price: LISTING_PRICE }).eq("id", madeToOrderId);
      if (error) throw new Error(`restore price: ${error.message}`);
    }
  }, 60_000);

  it("blocks a tracked line when stock is zero", async () => {
    const listingId = await seedListing({ isMadeToOrder: false, stockQty: 2 });
    h.client = buyer.client;
    const added = await addToCart(listingId, 2);
    expect(added.ok).toBe(true);
    const stored = await fixedCartLine(listingId);
    expect(stored).not.toBeNull();
    if (!stored) return;

    const { error } = await svc().from("listings").update({ stock_qty: 0 }).eq("id", listingId);
    expect(error).toBeNull();
    const page = await buyerPage();
    const line = page.lines.find((row) => row.lineId === stored.id);
    expect(line?.blockedReason).toBe("stock");
    expect(line?.stockLabel).toBe("out_of_stock");
  });

  it("returns the unavailable state when the store is not active", async () => {
    await clearCart();
    h.client = buyer.client;
    const added = await addToCart(fixedId, 1);
    expect(added.ok).toBe(true);
    const stored = await fixedCartLine(fixedId);
    expect(stored).not.toBeNull();
    if (!stored) return;

    await setStoreStatus("suspended");
    try {
      const page = await buyerPage();
      const line = page.lines.find((row) => row.lineId === stored.id);
      expect(line?.blockedReason).toBe("stock");
      expect(line?.stockLabel).toBe("unavailable");
    } finally {
      await setStoreStatus("active");
    }
  });

  it("moves the goods subtotal when quantity changes and a line is removed", async () => {
    await clearCart();
    const secondId = await seedListing({ isMadeToOrder: false, stockQty: 4 });
    h.client = buyer.client;
    expect((await addToCart(fixedId, 1)).ok).toBe(true);
    expect((await addToCart(secondId, 1)).ok).toBe(true);
    const first = await fixedCartLine(fixedId);
    const second = await fixedCartLine(secondId);
    expect(first && second).toBeTruthy();
    if (!first || !second) return;

    const before = await buyerPage();
    expect(goodsSubtotal(before.lines)).toBe(LISTING_PRICE * 2);

    h.client = buyer.client;
    const updated = await setCartItemQuantity({ cartItemId: first.id, quantity: 3 });
    expect(updated.ok).toBe(true);
    const afterQty = await buyerPage();
    expect(afterQty.lines.find((row) => row.lineId === first.id)?.quantity).toBe(3);
    expect(money((await fixedCartLine(fixedId))!.unit_price)).toBe(LISTING_PRICE);
    expect(goodsSubtotal(afterQty.lines)).toBe(LISTING_PRICE * 4);

    h.client = buyer.client;
    expect((await removeCartItem({ cartItemId: second.id })).ok).toBe(true);
    const afterRemove = await buyerPage();
    expect(afterRemove.lines.find((row) => row.lineId === second.id)).toBeUndefined();
    expect(goodsSubtotal(afterRemove.lines)).toBe(LISTING_PRICE * 3);
  });

  it("restores a fixed snapshot and a live custom line on a past-deadline system cancel, and omits an expired custom line", async () => {
    const windowBefore = await settingRaw("payment_window_minutes");
    const trackedId = await seedListing({ isMadeToOrder: false, stockQty: 5 });
    const startStock = await stockOf(trackedId);
    expect(startStock).toBe(5);

    const liveInquiry = await seedQuotedInquiry(
      madeToOrderId,
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      88,
    );
    const orderId = await seedOrder("live", "pending", [
      { listingId: trackedId, quantity: 2, unitPrice: 64, inquiryId: null },
      { listingId: madeToOrderId, quantity: 3, unitPrice: 88, inquiryId: liveInquiry },
    ]);
    expect(await stockOf(trackedId)).toBe(3);
    expect(await historyCount([orderId])).toBe(0);

    await clearCart();
    const cancelled = await cancelBySystem(orderId);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelled_by).toBe("system");
    expect(await stockOf(trackedId)).toBe(5);
    expect(await historyCount([orderId])).toBe(0);

    const fixed = await fixedCartLine(trackedId);
    const custom = await customCartLine(liveInquiry);
    expect(fixed).toMatchObject({ quantity: 2, is_custom: false, inquiry_id: null });
    expect(money(fixed!.unit_price)).toBe(64);
    expect(custom).toMatchObject({ quantity: 3, is_custom: true, inquiry_id: liveInquiry });
    expect(money(custom!.unit_price)).toBe(88);

    const page = await buyerPage();
    expect(page.lines.find((row) => row.lineId === fixed!.id)?.unitPrice).toBe(64);
    expect(page.lines.find((row) => row.inquiryId === liveInquiry)?.blockedReason).toBeNull();

    await clearCart();
    const pastInquiry = await seedQuotedInquiry(
      madeToOrderId,
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      88,
    );
    const pastOrderId = await seedOrder("past", "pending", [
      { listingId: trackedId, quantity: 1, unitPrice: 71, inquiryId: null },
      { listingId: madeToOrderId, quantity: 1, unitPrice: 88, inquiryId: pastInquiry },
    ]);
    const pastCancel = await cancelBySystem(pastOrderId);
    expect(pastCancel.cancelled_by).toBe("system");
    expect(await historyCount([pastOrderId])).toBe(0);
    expect(await customCartLine(pastInquiry)).toBeNull();
    const pastFixed = await fixedCartLine(trackedId);
    expect(money(pastFixed!.unit_price)).toBe(71);
    expect(pastFixed!.quantity).toBe(1);
    const pastPage = await buyerPage();
    expect(pastPage.lines.some((row) => row.inquiryId === pastInquiry)).toBe(false);
    expect(pastPage.lines.find((row) => row.lineId === pastFixed!.id)?.unitPrice).toBe(71);
    expect(await stockOf(trackedId)).toBe(5);
    expect(await settingRaw("payment_window_minutes")).toBe(windowBefore);
  }, 60_000);

  it("returns nothing for a guest and creates no inquiry", async () => {
    const { count: beforeCart, error: cartErr } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id);
    if (cartErr) throw new Error(cartErr.message);
    const { count: beforeInquiries, error: inqErr } = await svc()
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", madeToOrderId);
    if (inqErr) throw new Error(inqErr.message);

    h.client = anonClient();
    const page = await getCartPage("en", FALLBACKS);
    expect(page.ok).toBe(false);
    const guestInquiry = await createInquiry({ listingId: madeToOrderId, message: `guest ${RUN}` });
    expect(guestInquiry).toEqual({ ok: false, reason: "unauthenticated" });

    const { count: afterCart } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id);
    const { count: afterInquiries } = await svc()
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", madeToOrderId);
    expect(afterCart).toBe(beforeCart);
    expect(afterInquiries).toBe(beforeInquiries);
  });

  it("refuses a direct buyer insert and a direct update of quantity and unit price", async () => {
    await clearCart();
    h.client = buyer.client;
    expect((await addToCart(fixedId, 1)).ok).toBe(true);
    const stored = await fixedCartLine(fixedId);
    expect(stored).not.toBeNull();
    if (!stored) return;

    const inserted = await buyer.client.schema("betk").from("cart_items").insert({
      buyer_id: buyer.id,
      listing_id: fixedId,
      quantity: 1,
      unit_price: 1,
      is_custom: false,
    });
    expect(permissionDenied(inserted.error)).toBe(true);
    const { count } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id)
      .eq("listing_id", fixedId)
      .is("inquiry_id", null);
    expect(count).toBe(1);

    const quantityWrite = await buyer.client
      .schema("betk")
      .from("cart_items")
      .update({ quantity: 9 })
      .eq("id", stored.id);
    expect(permissionDenied(quantityWrite.error)).toBe(true);
    const priceWrite = await buyer.client
      .schema("betk")
      .from("cart_items")
      .update({ unit_price: 1 })
      .eq("id", stored.id);
    expect(permissionDenied(priceWrite.error)).toBe(true);
    const after = await fixedCartLine(fixedId);
    expect(after?.quantity).toBe(1);
    expect(money(after!.unit_price)).toBe(LISTING_PRICE);
  });

  it("refuses a direct seller write of quote columns and still allows a status change", async () => {
    const inquiryId = await openInquiry(madeToOrderId, "columns");
    h.client = seller.client;
    const priceWrite = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ quoted_price: 50 })
      .eq("id", inquiryId);
    const prepWrite = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ quoted_prep_days: 4 })
      .eq("id", inquiryId);
    const expiryWrite = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ quote_expires_at: new Date(Date.now() + 3_600_000).toISOString() })
      .eq("id", inquiryId);
    const quotedAtWrite = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ quoted_at: new Date().toISOString() })
      .eq("id", inquiryId);
    expect(permissionDenied(priceWrite.error)).toBe(true);
    expect(permissionDenied(prepWrite.error)).toBe(true);
    expect(permissionDenied(expiryWrite.error)).toBe(true);
    expect(permissionDenied(quotedAtWrite.error)).toBe(true);
    const unchanged = await quoteRow(inquiryId);
    expect(unchanged.quoted_price).toBeNull();
    expect(unchanged.quoted_prep_days).toBeNull();
    expect(unchanged.quote_expires_at).toBeNull();

    const { error: statusErr } = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ status: "replied" })
      .eq("id", inquiryId);
    expect(statusErr).toBeNull();
    expect((await quoteRow(inquiryId)).status).toBe("replied");
  });

  it("refuses a direct avg_response_hours write, ignores a buyer message, and matches the seller-reply formula", async () => {
    const inquiryId = await openInquiry(madeToOrderId, "avg");
    const { data: beforeRow, error: beforeErr } = await svc()
      .from("seller_profiles")
      .select("avg_response_hours")
      .eq("id", seller.id)
      .single();
    if (beforeErr || !beforeRow) throw new Error(beforeErr?.message ?? "profile");
    expect(beforeRow.avg_response_hours).toBeNull();

    h.client = buyer.client;
    const buyerMessage = await sendInquiryMessage({ inquiryId, body: `buyer ${RUN}` });
    expect(buyerMessage.ok).toBe(true);
    const { data: afterBuyer } = await svc()
      .from("seller_profiles")
      .select("avg_response_hours")
      .eq("id", seller.id)
      .single();
    expect(afterBuyer?.avg_response_hours).toBeNull();

    h.client = seller.client;
    const direct = await seller.client
      .schema("betk")
      .from("seller_profiles")
      .update({ avg_response_hours: 9 })
      .eq("id", seller.id);
    expect(permissionDenied(direct.error)).toBe(true);
    const { data: afterDirect } = await svc()
      .from("seller_profiles")
      .select("avg_response_hours")
      .eq("id", seller.id)
      .single();
    expect(afterDirect?.avg_response_hours).toBeNull();

    h.client = seller.client;
    const sellerMessage = await sendInquiryMessage({ inquiryId, body: `seller ${RUN}` });
    expect(sellerMessage.ok).toBe(true);

    const { data: inquiry, error: inquiryErr } = await svc()
      .from("inquiries")
      .select("created_at")
      .eq("id", inquiryId)
      .single();
    if (inquiryErr || !inquiry) throw new Error(inquiryErr?.message ?? "inquiry");
    const { data: messages, error: msgErr } = await svc()
      .from("inquiry_messages")
      .select("sent_at")
      .eq("inquiry_id", inquiryId)
      .eq("sender_type", "seller");
    if (msgErr || !messages?.[0]) throw new Error(msgErr?.message ?? "seller message");
    const expected = computeAvgResponseHours([
      { inquiryCreatedAt: inquiry.created_at, firstSellerReplyAt: messages[0].sent_at },
    ]);
    const { data: afterSeller } = await svc()
      .from("seller_profiles")
      .select("avg_response_hours")
      .eq("id", seller.id)
      .single();
    expect(afterSeller?.avg_response_hours).not.toBeNull();
    expect(Number(afterSeller?.avg_response_hours)).toBe(expected);
  });

  it("refuses add, accept, and send when the store is not active", async () => {
    await clearCart();
    const inquiryId = await openInquiry(madeToOrderId, "suspend");
    await quoteInquiry(inquiryId, LISTING_PRICE, 1);
    const quoted = money((await quoteRow(inquiryId)).quoted_price);

    await setStoreStatus("suspended");
    try {
      h.client = buyer.client;
      const added = await addToCart(fixedId, 1);
      expect(added.ok).toBe(false);
      if (!added.ok) expect(added.messageKey).toBe("cartStoreInactive");
      expect(await fixedCartLine(fixedId)).toBeNull();

      const accepted = await acceptInquiryQuote({ inquiryId });
      expect(accepted.ok).toBe(false);
      if (!accepted.ok) expect(accepted.messageKey).toBe("quoteStoreInactive");
      expect(await customCartLine(inquiryId)).toBeNull();

      h.client = seller.client;
      const sent = await sendInquiryQuote({
        inquiryId,
        quotedPrice: LISTING_PRICE * multiplier,
        prepDays: 1,
      });
      expect(sent.ok).toBe(false);
      if (!sent.ok) expect(sent.messageKey).toBe("quoteStoreInactive");
      expect(money((await quoteRow(inquiryId)).quoted_price)).toBe(quoted);
    } finally {
      await setStoreStatus("active");
    }
  });

  it("refuses accept and send on a declined inquiry and stores nothing", async () => {
    const inquiryId = await openInquiry(madeToOrderId, "declined");
    h.client = seller.client;
    const { error } = await seller.client
      .schema("betk")
      .from("inquiries")
      .update({ status: "declined" })
      .eq("id", inquiryId);
    expect(error).toBeNull();
    expect((await quoteRow(inquiryId)).status).toBe("declined");

    h.client = buyer.client;
    const accepted = await acceptInquiryQuote({ inquiryId });
    expect(accepted.ok).toBe(false);
    if (!accepted.ok) expect(accepted.messageKey).toBe("quoteDeclined");
    expect(await customCartLine(inquiryId)).toBeNull();

    h.client = seller.client;
    const sent = await sendInquiryQuote({ inquiryId, quotedPrice: LISTING_PRICE, prepDays: 1 });
    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.messageKey).toBe("quoteDeclined");
    expect((await quoteRow(inquiryId)).quoted_price).toBeNull();
  });
});
