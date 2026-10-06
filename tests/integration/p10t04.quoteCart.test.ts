/**
 * P10 T04 — quote, accept, and fixed-price add, against staging.
 *
 * The band and the validity window are read from admin_settings. This file
 * does not call checkout_from_cart and does not write payment_window_minutes.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { createInquiry } from "@/features/messaging/actions/createInquiry";
import { sendInquiryQuote } from "@/features/messaging/actions/sendInquiryQuote";
import { acceptInquiryQuote } from "@/features/messaging/actions/acceptInquiryQuote";
import { addToCart } from "@/features/discovery/actions/addToCart";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P10T04_${RUN}!`;
const EMAIL_PREFIX = "betk-p10t04-";
const LISTING_PRICE = 100;

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];

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

async function createBuyer(label: string): Promise<{ id: string; client: BetkClient }> {
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

  const { data: version, error: versionErr } = await svc()
    .from("admin_settings")
    .select("value")
    .eq("key", "agreement_buyer_terms_version")
    .single();
  if (versionErr || !version?.value) {
    throw new Error(`buyer terms version: ${versionErr?.message}`);
  }
  const { error: acceptErr } = await svc().from("agreement_acceptances").insert({
    user_id: id,
    document: "buyer_terms",
    version_label: version.value,
  });
  if (acceptErr) throw new Error(`buyer terms seed(${label}): ${acceptErr.message}`);

  return { id, client: await signIn(email) };
}

async function createSeller(label: string): Promise<{ id: string; client: BetkClient; storeId: string }> {
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
      name_ar: `متجر ${label} ${RUN}`,
      slug: `p10t04-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}): ${stErr?.message}`);

  return { id, client: await signIn(email), storeId: store.id };
}

async function seedListing(
  storeId: string,
  categoryId: string,
  fields: { isMadeToOrder: boolean; stockQty: number },
): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `منتج ${RUN}`,
      price: LISTING_PRICE,
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

async function settingNumber(key: string): Promise<number> {
  const { data, error } = await svc().from("admin_settings").select("value").eq("key", key).single();
  if (error || data?.value == null) throw new Error(`${key}: ${error?.message ?? "missing"}`);
  const value = Number(data.value);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} is not a positive number`);
  return value;
}

async function inquiryCount(listingId: string): Promise<number> {
  const { count, error } = await svc()
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function quoteRow(inquiryId: string) {
  const { data, error } = await svc()
    .from("inquiries")
    .select("quoted_price, quoted_prep_days, quoted_at, quote_expires_at")
    .eq("id", inquiryId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "missing inquiry");
  return data;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P10 T04 — quote, accept, and fixed-price add", () => {
  let seller: { id: string; client: BetkClient; storeId: string };
  let buyer: { id: string; client: BetkClient };
  let categoryId: string;
  let madeToOrderId: string;
  let fixedId: string;
  let multiplier: number;
  let validityHours: number;

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. Allowed: ${STAGING_ALLOWLIST.join(", ")}.`,
      );
    }

    const { data: stale } = await svc().from("stores").select("id, seller_id").like("slug", "p10t04-%");
    if (stale && stale.length > 0) {
      const storeIds = stale.map((row) => row.id);
      const { data: staleInquiries } = await svc().from("inquiries").select("id").in("store_id", storeIds);
      const inquiryIds = (staleInquiries ?? []).map((row) => row.id);
      if (inquiryIds.length > 0) {
        await svc().from("cart_items").delete().in("inquiry_id", inquiryIds);
      }
      await svc().from("inquiries").delete().in("store_id", storeIds);
      await svc().from("users").delete().in(
        "id",
        stale.map((row) => row.seller_id),
      );
    }

    multiplier = await settingNumber("quote_tolerance_multiplier");
    validityHours = await settingNumber("quote_validity_hours");

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

    madeToOrderId = await seedListing(seller.storeId, categoryId, { isMadeToOrder: true, stockQty: 5 });
    fixedId = await seedListing(seller.storeId, categoryId, { isMadeToOrder: false, stockQty: 1 });
  });

  afterAll(async () => {
    if (createdAuthIds.length > 0) {
      await svc().from("cart_items").delete().in("buyer_id", createdAuthIds);
      await svc().from("inquiries").delete().in("buyer_id", createdAuthIds);
      await svc().from("agreement_acceptances").delete().in("user_id", createdAuthIds);
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it("refuses a price request on a priced listing that is not made-to-order, and accepts one that is", async () => {
    h.client = buyer.client;
    const before = await inquiryCount(fixedId);
    const refused = await createInquiry({ listingId: fixedId, message: `ثابت ${RUN}` });
    expect(refused).toEqual({ ok: false, reason: "listing_ineligible" });
    expect(await inquiryCount(fixedId)).toBe(before);

    const opened = await createInquiry({ listingId: madeToOrderId, message: `تفصيل ${RUN}` });
    expect(opened.ok).toBe(true);
  });

  it("refuses a quote below the price, above the ceiling, or without prep, and stores an in-band quote", async () => {
    h.client = buyer.client;
    const opened = await createInquiry({ listingId: madeToOrderId, message: `سعر ${RUN}` });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const inquiryId = opened.inquiryId;

    h.client = seller.client;
    const below = await sendInquiryQuote({
      inquiryId,
      quotedPrice: LISTING_PRICE - 1,
      prepDays: 1,
    });
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.messageKey).toBe("quoteOutOfBand");
    expect((await quoteRow(inquiryId)).quoted_price).toBeNull();

    const ceiling = LISTING_PRICE * multiplier;
    const above = await sendInquiryQuote({
      inquiryId,
      quotedPrice: ceiling + 1,
      prepDays: 1,
    });
    expect(above.ok).toBe(false);
    if (!above.ok) expect(above.messageKey).toBe("quoteOutOfBand");
    expect((await quoteRow(inquiryId)).quoted_price).toBeNull();

    const { error: prepError } = await seller.client.schema("betk").rpc("send_inquiry_quote", {
      p_inquiry_id: inquiryId,
      p_quoted_price: LISTING_PRICE,
      p_prep_days: null as unknown as number,
    });
    expect(prepError?.message ?? "").toContain("BETK_QUOTE_PREP_REQUIRED");
    expect((await quoteRow(inquiryId)).quoted_price).toBeNull();

    const atFloor = await sendInquiryQuote({
      inquiryId,
      quotedPrice: LISTING_PRICE,
      prepDays: 0,
    });
    expect(atFloor.ok).toBe(true);
    const floorRow = await quoteRow(inquiryId);
    expect(Number(floorRow.quoted_price)).toBe(LISTING_PRICE);
    expect(floorRow.quoted_prep_days).toBe(0);
    expect(floorRow.quoted_at).toEqual(expect.any(String));
    expect(floorRow.quote_expires_at).toEqual(expect.any(String));
    const floorDelta = Date.parse(floorRow.quote_expires_at!) - Date.parse(floorRow.quoted_at!);
    expect(Math.abs(floorDelta - validityHours * 60 * 60 * 1000)).toBeLessThan(60_000);

    const atCeiling = await sendInquiryQuote({
      inquiryId,
      quotedPrice: ceiling,
      prepDays: 3,
    });
    expect(atCeiling.ok).toBe(true);
    const ceilingRow = await quoteRow(inquiryId);
    expect(Number(ceilingRow.quoted_price)).toBe(ceiling);
    expect(ceilingRow.quoted_prep_days).toBe(3);
    expect(ceilingRow.quoted_at).toEqual(expect.any(String));
    expect(ceilingRow.quote_expires_at).toEqual(expect.any(String));

    const savedExpires = ceilingRow.quote_expires_at;
    const { error: expireErr } = await svc()
      .from("inquiries")
      .update({ quote_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", inquiryId);
    if (expireErr) throw new Error(expireErr.message);

    h.client = buyer.client;
    const expired = await acceptInquiryQuote({ inquiryId });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.messageKey).toBe("quoteExpired");
    const { count: none, error: noneErr } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("inquiry_id", inquiryId);
    if (noneErr) throw new Error(noneErr.message);
    expect(none).toBe(0);

    const { error: restoreErr } = await svc()
      .from("inquiries")
      .update({ quote_expires_at: savedExpires })
      .eq("id", inquiryId);
    if (restoreErr) throw new Error(restoreErr.message);

    const accepted = await acceptInquiryQuote({ inquiryId });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const { data: line, error: lineErr } = await svc()
      .from("cart_items")
      .select("is_custom, unit_price, quantity")
      .eq("id", accepted.cartItemId)
      .single();
    if (lineErr || !line) throw new Error(lineErr?.message ?? "missing cart line");
    expect(line.is_custom).toBe(true);
    expect(Number(line.unit_price)).toBe(ceiling);
    expect(line.quantity).toBe(1);
  });

  it("refuses a quote on a listing that is neither made-to-order nor unpriced", async () => {
    const { data, error } = await svc()
      .from("inquiries")
      .insert({
        buyer_id: buyer.id,
        store_id: seller.storeId,
        listing_id: fixedId,
        buyer_first_message: `غير مؤهل ${RUN}`,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "inquiry seed");

    h.client = seller.client;
    const refused = await sendInquiryQuote({
      inquiryId: data.id,
      quotedPrice: LISTING_PRICE,
      prepDays: 1,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.messageKey).toBe("quoteListingIneligible");
    expect((await quoteRow(data.id)).quoted_price).toBeNull();
  });

  it("refuses a guest add and an over-stock add, then inserts one line and refuses a second", async () => {
    const { count: before, error: beforeErr } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", fixedId);
    if (beforeErr) throw new Error(beforeErr.message);

    h.client = anonClient();
    const guest = await addToCart(fixedId);
    expect(guest).toEqual({ ok: false, reason: "unauthenticated", messageKey: "unauthenticated" });
    const { count: afterGuest, error: guestErr } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", fixedId);
    if (guestErr) throw new Error(guestErr.message);
    expect(afterGuest).toBe(before);

    h.client = buyer.client;
    const over = await addToCart(fixedId, 2);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.messageKey).toBe("cartOutOfStock");
    const { count: afterOver, error: overErr } = await svc()
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", fixedId);
    if (overErr) throw new Error(overErr.message);
    expect(afterOver).toBe(before);

    const added = await addToCart(fixedId, 1);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const { data: line, error: lineErr } = await svc()
      .from("cart_items")
      .select("quantity, unit_price, is_custom, inquiry_id")
      .eq("id", added.cartItemId)
      .single();
    if (lineErr || !line) throw new Error(lineErr?.message ?? "missing cart line");
    expect(line.quantity).toBe(1);
    expect(Number(line.unit_price)).toBe(LISTING_PRICE);
    expect(line.is_custom).toBe(false);
    expect(line.inquiry_id).toBeNull();

    const again = await addToCart(fixedId);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.messageKey).toBe("cartLineExists");
    const { data: still, error: stillErr } = await svc()
      .from("cart_items")
      .select("quantity")
      .eq("id", added.cartItemId)
      .single();
    if (stillErr || !still) throw new Error(stillErr?.message ?? "missing cart line");
    expect(still.quantity).toBe(1);
  });
});
